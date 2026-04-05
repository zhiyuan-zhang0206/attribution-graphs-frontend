// 初始化 attribution graph 前端：game selector + token bar + 棋盘渲染

window.init = async function(){
  var {graphs} = await util.getFile('/data/graph-metadata.json')

  // 按 slug 前缀分组: "game-pos5" → prefix "game", position 5
  var posPattern = /^(.+)-pos(\d+)$/
  var groupMap = {}
  graphs.forEach(g => {
    var m = g.slug.match(posPattern)
    if (m) {
      var prefix = m[1]
      if (!groupMap[prefix]) groupMap[prefix] = []
      groupMap[prefix].push({...g, posIdx: parseInt(m[2])})
    }
  })
  Object.values(groupMap).forEach(arr => arr.sort((a, b) => a.posIdx - b.posIdx))

  window.visState = window.visState || {
    slug: util.params.get('slug') || graphs[0].slug,
    clickedId: util.params.get('clickedId')?.replace('null', ''),
    isGridsnap: util.params.get('isGridsnap')?.replace('null', ''),
  }

  // --- Dropdown: 每个 game group 一项 + 非分组的 graph ---
  var dropdownItems = []
  var groupPrefixes = new Set()
  for (var [prefix, members] of Object.entries(groupMap)) {
    if (members.length > 1) {
      groupPrefixes.add(prefix)
      dropdownItems.push({
        slug: members[0].slug,
        label: (members[0].scan || prefix) + ' — Game: ' + prefix + ' (' + members.length + ' positions)',
        prefix: prefix,
        isGroup: true,
        prompt_tokens: members[0].prompt_tokens,
      })
    }
  }
  graphs.forEach(g => {
    var m = g.slug.match(posPattern)
    if (m && groupPrefixes.has(m[1])) return
    dropdownItems.push({
      slug: g.slug,
      label: (util.nameToPrettyPrint?.[g.scan] || g.scan || '') + ' — ' + g.prompt,
      isGroup: false,
    })
  })

  var selectSel = d3.select('.nav').html('').append('select.graph-prompt-select')
    .on('change', function() {
      visState.slug = this.value
      visState.clickedId = undefined
      util.params.set('slug', this.value)
      renderTokenBar()
      render()
    })

  selectSel.appendMany('option', dropdownItems)
    .text(d => d.label)
    .attr('value', d => d.slug)
    .property('selected', d => d.slug === visState.slug)

  // --- Token bar: 点击 token 切换 position ---
  function getGroupForSlug(slug) {
    var m = slug.match(posPattern)
    return m ? (groupMap[m[1]] || null) : null
  }

  function renderTokenBar() {
    var barSel = d3.select('.token-bar')
    var group = getGroupForSlug(visState.slug)

    if (!group || group.length <= 1) {
      barSel.style('display', 'none').html('')
      return
    }

    barSel.style('display', 'flex').html('')

    var tokens = group[0].prompt_tokens || []
    var currentMatch = visState.slug.match(posPattern)
    var currentPos = currentMatch ? parseInt(currentMatch[2]) : -1
    var posSet = new Set(group.map(g => g.posIdx))

    tokens.forEach((tok, idx) => {
      var hasGraph = posSet.has(idx)
      var tokenSel = barSel.append('span')
        .classed('token', true)
        .classed('active', idx === currentPos)
        .classed('before-active', idx < currentPos && idx > 0)
        .text(tok)
        .attr('title', 'pos ' + idx + (hasGraph ? '' : ' (no graph)'))

      if (hasGraph) {
        tokenSel.style('cursor', 'pointer')
          .on('click', function() {
            var prefix = currentMatch[1]
            visState.slug = prefix + '-pos' + idx
            visState.clickedId = undefined
            util.params.set('slug', visState.slug)
            selectSel.property('value', dropdownItems.find(d => d.isGroup && d.prefix === prefix)?.slug || visState.slug)
            renderTokenBar()
            render()
          })
      } else {
        tokenSel.style('cursor', 'default').style('opacity', '0.4')
      }
    })
  }

  function render() {
    d3.select('.cg').html('')
    initCg(d3.select('.cg'), visState.slug, {
      clickedId: visState.clickedId,
      clickedIdCb: id => util.params.set('clickedId', id),
      isGridsnap: visState.isGridsnap || true
    })

    var m = graphs.find(g => g.slug == visState.slug)
    if (!m) return
    selectSel.at({title: m.prompt})
    document.title = 'Attribution Graph: ' + m.prompt
  }

  // 初始化 dropdown 选中状态
  var currentGroup = getGroupForSlug(visState.slug)
  if (currentGroup) {
    var prefix = visState.slug.match(posPattern)[1]
    var groupItem = dropdownItems.find(d => d.isGroup && d.prefix === prefix)
    if (groupItem) selectSel.property('value', groupItem.slug)
  }

  renderTokenBar()
  render()
}

window.init()
