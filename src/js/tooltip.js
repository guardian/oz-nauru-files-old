import Ractive from 'ractive'

String.prototype.trunc = String.prototype.trunc ||
  function(n){
      return (this.length > n) ? this.substr(0,n-1)+'&hellip;' : this;
};

var tooltipDecorator = function ( node, date, risk, category, text) {
  var tooltip, handlers, eventName;
  var textLength = 80
  var textSnippet = text ? text.trunc(textLength) : ""
  handlers = {
    mouseover: function () {
      tooltip = document.createElement( 'div' );
      tooltip.className = 'tooltip';
      var htmlContent = `<h3>${date}</h3><div class="severity"><span class="rating-${risk}">${risk}</span></div> 
          <div class="category">Type of Incident: ${category}</div>
          <div class="text">${textSnippet}`
      htmlContent = (text.length > textLength) ? htmlContent.concat(" <span class='more'>click to see more</spn></div>") : htmlContent.concat("</div>")
      tooltip.innerHTML = htmlContent
      node.parentNode.parentNode.insertBefore( tooltip, node.parentNode );
    },

    mousemove: function ( event ) {
      tooltip.style.left = event.clientX - node.parentNode.parentNode.getBoundingClientRect().left + 'px';
      tooltip.style.top = ( event.clientY - node.parentNode.parentNode.getBoundingClientRect().top) + 'px';
    },

    click: function () {
      if (tooltip) {
        // tooltip.parentNode.removeChild( tooltip );
      }
    },

    mouseleave: function () {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild( tooltip );
      }    
    }
  };

  for ( eventName in handlers ) {
    if ( handlers.hasOwnProperty( eventName ) ) {
      node.addEventListener( eventName, handlers[ eventName ], false );
    }
  }
  return {
    teardown: function () {
      for ( eventName in handlers ) {
        if ( handlers.hasOwnProperty( eventName ) ) {
          node.removeEventListener( eventName, handlers[ eventName ], false );
        }
      }
    }
  };
};

export default tooltipDecorator