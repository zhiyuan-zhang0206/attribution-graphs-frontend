window.initCgButtonContainer = function({visState, renderAll, data, cgSel}){
  var buttonContainer = cgSel.select('.button-container').html('')
    .st({marginBottom: '10px'})

  var linkTypeSel= buttonContainer.append('div.link-type-buttons')
    .appendMany('div', ['input', 'output', 'either', 'both'])
    .text(d => d[0].toUpperCase() + d.slice(1).toLowerCase())
    .on('click', (ev, d) => {
      visState.linkType = d
      renderAll.linkType()
    })

  renderAll.linkType.fns.push(() => {
    linkTypeSel.classed('active', d => d === visState.linkType)
  })
  var showAllSel = buttonContainer.append('div.toggle-buttons')
    .append('div').text('Show all links')
    .on('click', () => {
      visState.isShowAllLinks = visState.isShowAllLinks ? '' : '1'
      renderAll.isShowAllLinks()
    })

  renderAll.isShowAllLinks.fns.push(() => {
    showAllSel.classed('active', visState.isShowAllLinks)
  })

  var hasQKLinks = data.links.some(d => d.isQK)
  if (hasQKLinks) {
    var qkToggleSel = buttonContainer.append('div.toggle-buttons')
      .append('div').text('QK edges')
      .on('click', () => {
        visState.isShowQK = !visState.isShowQK
        renderAll.isShowQK()
      })

    renderAll.isShowQK.fns.push(() => {
      qkToggleSel.classed('active', visState.isShowQK)
    })
  }

  var clearButtonsSel = buttonContainer.append('div.toggle-buttons')
    .appendMany('div', ['Clear pinned', 'Clear clicked'])
    .text(d => d)
    .on('click', (ev, d) => {
      if (d == 'Clear pinned') {
        visState.pinnedIds = []
        renderAll.pinnedIds()
      } else {
        visState.clickedId = ''
        renderAll.clickedId()
      }
    })

  cgSel.on('keydown.esc-check', ev => {
    if (ev.key == 'Escape') {
      visState.clickedId = ''
      renderAll.clickedId()
    }
  })

  // — Threshold sliders —
  var thresholdContainer = buttonContainer.append('div.threshold-sliders')
    .st({display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap'})

  function addSlider(container, label, key, min, max, step) {
    var wrap = container.append('div').st({display: 'flex', alignItems: 'center', gap: '4px'})
    wrap.append('span').text(label).st({fontSize: '11px', whiteSpace: 'nowrap'})
    var input = wrap.append('input')
      .at({type: 'range', min, max, step, value: visState[key]})
      .st({width: '80px'})
    var valLabel = wrap.append('span').st({fontSize: '11px', minWidth: '32px'})
      .text(d3.format('.0%')(visState[key]))

    input.on('input', function() {
      visState[key] = +this.value
      valLabel.text(d3.format('.0%')(visState[key]))
      renderAll.threshold()
    })

    renderAll.threshold.fns.push(() => {
      input.property('value', visState[key])
      valLabel.text(d3.format('.0%')(visState[key]))
    })
  }

  addSlider(thresholdContainer, 'Nodes', 'nodeThreshold', 0.3, 1.0, 0.01)
  addSlider(thresholdContainer, 'Edges', 'edgeThreshold', 0.3, 1.0, 0.01)

  var countLabel = thresholdContainer.append('span')
    .st({fontSize: '10px', color: '#888'})
  renderAll.threshold.fns.push(() => {
    countLabel.text(`${data.visibleNodeCount} nodes, ${data.visibleLinkCount} edges`)
  })

  var resetGridSel = buttonContainer.append('div.toggle-buttons')
    .append('div').text('Reset grid')
    .on('click', () => {
      util.params.set('gridsnap', '') // TODO: this won't work with baked in features
      window.location.reload()
    })

  var onSyncValue = visState.isSyncEnabled || '1'
  var syncButtonSel = buttonContainer.append('div.toggle-buttons')
    .append('div').text('Enable sync')
    .on('click', () => {
      visState.isSyncEnabled = visState.isSyncEnabled ? '' : onSyncValue
      renderAll.isSyncEnabled()
    })

  renderAll.isSyncEnabled.fns.push(() => {
    syncButtonSel.classed('active', visState.isSyncEnabled)
  });

}

window.init?.()
