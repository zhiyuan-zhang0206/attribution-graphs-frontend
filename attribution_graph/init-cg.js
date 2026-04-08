window.initCgOthelloBoard = function({data, cgSel}) {
  var boardSel = cgSel.select('.othello-board').html('')
  if (!boardSel.node()) return
  var tokens = data.metadata.prompt_tokens
  if (!tokens || tokens.length < 1 || typeof initOthelloBoard === 'undefined') return

  boardSel.st({overflow: 'auto', padding: '4px'})

  // Detect board size from scan name (e.g. "othello-6x6-10x" → 6)
  var boardSize = 6
  var scanMatch = (data.metadata.scan || '').match(/(\d+)x(\d+)/)
  if (scanMatch) boardSize = parseInt(scanMatch[1], 10)

  var currentPos = tokens.length - 1
  boardSel.append('div').attr('class', 'board-title').text('Board State')
    .st({fontSize: '13px', fontWeight: 600, marginBottom: '6px', fontFamily: 'system-ui, sans-serif', color: '#333'})
  initOthelloBoard(boardSel.append('div'), tokens, currentPos, boardSize)
}

window.initCg = async function (sel, slug, {clickedId, clickedIdCb, isModal, isGridsnap} = {}){
  var data = await util.getFile(`/graph_data/${slug}.json`)
  console.log(data)
  
  var visState = {
    pinnedIds: [],
    hiddenIds: [], 
    hoveredId: null,
    hoveredNodeId: null,
    hoveredCtxIdx: null,
    clickedId: null, 
    clickedCtxIdx: null,
    linkType: 'both',
    isShowAllLinks: '',
    isShowQK: false,
    isSyncEnabled: '',
    subgraph: null,
    isEditMode: 1,
    isHideLayer: data.metadata.scan == util.scanSlugToName.h35 || data.metadata.scan == util.scanSlugToName.moc, 
    sg_pos: '',
    isModal: true,
    nodeThreshold: 0.8,
    edgeThreshold: 0.9,
    isGridsnap,
    ...data.qParams
  }
  
  if (visState.clickedId?.includes('supernode')) delete visState.clickedId
  if (clickedId && clickedId != 'null' && !clickedId.includes('supernode-')) visState.clickedId = clickedId
  if (!visState.clickedId || visState.clickedId == 'null' || visState.clickedId == 'undefined') visState.clickedId = data.nodes.find(d => d.isLogit)?.nodeId
  
  if (visState.pinnedIds.replace) visState.pinnedIds = visState.pinnedIds.split(',')
  if (visState.hiddenIds.replace) visState.hiddenIds = visState.hiddenIds.split(',')

  await utilCg.formatData(data, visState)
  utilCg.computeVisibility(data, visState)

  var renderAll = util.initRenderAll(['hClerpUpdate', 'clickedId', 'hiddenIds', 'pinnedIds', 'linkType', 'isShowAllLinks', 'features', 'isSyncEnabled', 'shouldSortByWeight', 'hoveredId', 'isShowQK', 'threshold'])

  function colorNodes() {
    data.nodes.forEach(d => d.nodeColor = '#fff')
  }
  colorNodes()

  // global link color —  the color scale skips #fff so links are visible
  // TODO: weight by input sum instead
  function colorLinks() {
    var absMax = d3.max(data.links, d => d.absWeight)
    var _linearAbsScale = d3.scaleLinear().domain([-absMax, absMax])
    var _linearPctScale = d3.scaleLinear().domain([-.4, .4])
    var _linearTScale = d3.scaleLinear().domain([0, .5, .5, 1]).range([0, .5 - .001, .5 + .001, 1])

    var widthScale = d3.scaleSqrt().domain([0, 1]).range([.00001, 3])

    utilCg.pctInputColorFn = d => d3.interpolatePRGn(_linearTScale(_linearPctScale(d)))

    data.links.forEach(d => {
      // d.color = d3.interpolatePRGn(_linearTScale(_linearAbsScale(d.weight)))
      d.strokeWidth = widthScale(Math.abs(d.pctInput))
      if (d.isQK) {
        d.pctInputColor = d3.interpolateRdBu(0.5 - d.pctInput * 1.25)
        d.color = d.pctInputColor
      } else {
        d.pctInputColor = utilCg.pctInputColorFn(d.pctInput)
        d.color = d3.interpolatePRGn(_linearTScale(_linearPctScale(d.pctInput)))
      }
    })
  }
  colorLinks()

  renderAll.threshold.fns.push(() => utilCg.computeVisibility(data, visState))
  renderAll.hClerpUpdate.fns.push(() => utilCg.hClerpUpdateFn(null, data))

  renderAll.hoveredId.fns.push(() => {
    // use hovered node if possible, otherwise use last occurence of feature
    var targetCtxIdx = visState.hoveredCtxIdx ?? 999
    var hoveredNodes = data.nodes.filter(n => n.featureId == visState.hoveredId)
    var node = d3.sort(hoveredNodes, d => Math.abs(d.ctx_idx - targetCtxIdx))[0]
    visState.hoveredNodeId = node?.nodeId
  })

  // set tmpClickedLink w/ strength of all the links connected the clickedNode
  renderAll.clickedId.fns.push(() => {
    clickedIdCb?.(visState.clickedId)

    var node = data.nodes.idToNode[visState.clickedId]
    if (!node){
      // for a clicked supernode, sum over memberNode links to make tmpClickedLink
      if (visState.clickedId?.startsWith('supernode-')) {
        node = {
          nodeId: visState.clickedId,
          memberNodes: visState.subgraph.supernodes[+visState.clickedId.split('-')[1]]
            .slice(1)
            .map(id => data.nodes.idToNode[id])
        }
        node.memberSet = new Set(node.memberNodes.map(d => d.nodeId))

        function combineLinks(links, isSrc) {
          return d3.nestBy(links, d => isSrc ? d.sourceNode.nodeId : d.targetNode.nodeId)
            .map(links => ({
              source: isSrc ? links[0].sourceNode.nodeId : visState.clickedId,
              target: isSrc ? visState.clickedId : links[0].targetNode.nodeId,
              sourceNode: isSrc ? links[0].sourceNode : node,
              targetNode: isSrc ? node : links[0].targetNode,
              weight: d3.sum(links, d => d.weight),
              absWeight: Math.abs(d3.sum(links, d => d.weight))
            }))
        }

        node.sourceLinks = combineLinks(node.memberNodes.flatMap(d => d.sourceLinks), true)
        node.targetLinks = combineLinks(node.memberNodes.flatMap(d => d.targetLinks), false)
      } else {
        return data.nodes.forEach(d => {
          d.tmpClickedLink = null
          d.tmpClickedSourceLink = null
          d.tmpClickedTargetLink = null
        })
      }
    }

    var connectedLinks = [...node.sourceLinks, ...node.targetLinks]
    var max = d3.max(connectedLinks, d => d.absWeight)
    var colorScale = d3.scaleSequential(d3.interpolatePRGn).domain([-max*1.1, max*1.1])

    // allowing supernode links means each node can have a both tmpClickedSourceLink and tmpClickedTargetLink
    // currently we render bidirectional links where possible, falling back to the target side links otherwises
    var nodeIdToSourceLink = {}
    var nodeIdToTargetLink = {}
    var featureIdToLink = {}
    connectedLinks.forEach(link => {
      // QK edge 不参与 node connection 面板（避免覆盖 V edge 的 weight）
      if (link.isQK) return
      if (link.sourceNode === node) {
        nodeIdToTargetLink[link.targetNode.nodeId] = link
        featureIdToLink[link.targetNode.featureId] = link
        link.tmpClickedCtxOffset = link.targetNode.ctx_idx - node.ctx_idx
      }
      if (link.targetNode === node) {
        nodeIdToSourceLink[link.sourceNode.nodeId] = link
        featureIdToLink[link.sourceNode.featureId] = link
        link.tmpClickedCtxOffset = link.sourceNode.ctx_idx - node.ctx_idx
      }
      link.tmpColor = link.pctInputColor
    })

    data.nodes.forEach(d => {
      var link = nodeIdToSourceLink[d.nodeId] || nodeIdToTargetLink[d.nodeId]
      d.tmpClickedLink = link
      d.tmpClickedSourceLink = nodeIdToSourceLink[d.nodeId]
      d.tmpClickedTargetLink = nodeIdToTargetLink[d.nodeId]
    })

    data.features.forEach(d => {
      var link = featureIdToLink[d.featureId]
      d.tmpClickedLink = link
    })
  })

  function initGridsnap() {
    var gridData = [
      {cur: {x: 0, y: 0,  w: 14, h: 1}, class: 'button-container'},
      {cur: {x: 0, y: 8, w: 8, h: 8}, class: 'subgraph'},
      {cur: {x: 8, y: 1, w: 6, h: 6}, class: 'node-connections'},
      {cur: {x: 8, y: 6, w: 6, h: 10}, class: 'feature-detail'},
      {cur: {x: 0, y: 0, w: 8, h: 8}, class: 'link-graph', resizeFn: makeResizeFn(initCgLinkGraph)},
      {cur: {x: 14, y: 0, w: 3, h: 6}, class: 'othello-board'},
      // {cur: {x: 0, y: 18, w: 6, h: 7}, class: 'clerp-list'},
      // {cur: {x: 6, y: 30, w: 4, h: 7}, class: 'feature-scatter'},
      // {cur: {x: 0, y: 30, w: 3, h: 8}, class: 'metadata'},
     ].filter(d => d)

    var initFns = [
      initCgButtonContainer,
      initCgSubgraph,
      initCgLinkGraph,
      initCgNodeConnections,
      initCgFeatureDetail,
      initCgOthelloBoard,
      // initCgClerpList,
      // initCgFeatureScatter,
    ].filter(d => d)
    
    var gridsnapSel = sel.html('').append('div.gridsnap.cg')
      .classed('is-edit-mode', visState.isGridsnap)
    if (visState.isModal) gridsnapSel.st({width: '100%', height: '100%'})

    
    window.initGridsnap({
      gridData,
      gridSizeY: 50,
      pad: 10,
      sel: gridsnapSel,
      isFullScreenY: false,
      isFillContainer: visState.isModal,
      serializedGrid: data.qParams.gridsnap
    })

    initFns.forEach(fn => fn({visState, renderAll, data, cgSel: sel}))

    function makeResizeFn(fn){
      return () => {
        fn({visState, renderAll, data, cgSel: sel.select('.gridsnap.cg')})
        Object.values(renderAll).forEach(d => d())
      }
    }
  }

  initGridsnap()
  renderAll.hClerpUpdate()
  renderAll.isShowAllLinks()
  renderAll.linkType()
  renderAll.clickedId()
  renderAll.pinnedIds()
  renderAll.features()
  renderAll.isSyncEnabled()
  renderAll.hoveredId()
  renderAll.isShowQK()
  renderAll.threshold()
}

window.init?.()
