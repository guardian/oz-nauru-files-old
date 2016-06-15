import reqwest from 'reqwest'
import iframeMessenger from 'guardian/iframe-messenger'
import mainHTML from './text/main.html!text'
import gridItem from './text/gridItem.html!text'
import share from './lib/share'
import Ractive from 'ractive'
import ractiveFade from 'ractive-transitions-fade'
import ractiveTap from 'ractive-events-tap'
import d3 from 'd3'
import Modal from './modal'
import Tooltip from './tooltip'
import nauruData from './data/nauru2.json!json'

var shareFn = share('Interactive title', 'http://gu.com/p/URL', '#Interactive');

export function init(el, context, config, mediator) {
    el.innerHTML = mainHTML.replace(/%assetPath%/g, config.assetPath);
    var dateFormat = d3.time.format("%d/%m/%Y");
    var dateDisplay = d3.time.format("%d %B %Y");
    var getMonth = d3.time.format("%B");
    var getYear = d3.time.format("%Y");
    var year = 2015;
    var filteredData,filteredYearMonth;
    var incidentRating = "All";
    var category = "All"
    var topCategories = []
    var sortYear = function (a, b) { d3.ascending(getYear.parse(a), getYear.parse(b)) };
    var sortMonth = function (a, b) { d3.ascending(getMonth.parse(a), getMonth.parse(b)) };
    var updateMsg = document.getElementById("updating-msg")
    var nauruJson = nauruData;

    nauruJson.forEach( function(d,i) {
        d.id = i
        d.date = dateFormat.parse(d.date);
        d.dateDisplay = dateDisplay(d.date)
        d.month = getMonth(d.date);
        d.year = getYear(d.date);
    });

    var nauruCategoryMap = d3.map(nauruJson, (d) => d.type)

    var nauruYearMonth = d3.nest()
        .key(function(d) { return d.year; })
        .key(function(d) { return d.month; })
        .entries(nauruJson);

    var topCategoriesByYear = d3.nest()
        .key(function(d) { return d.year; })
        .key(function(d) { return d.type; })
        .rollup((d) => d.length)
        .entries(nauruJson);

    var topCategoriesMap = d3.map(topCategoriesByYear, (d) => d.key)
    topCategoriesMap.forEach((key, entry) => {
        entry.values.sort((a,b) => d3.descending(a.values,b.values))
    })

    var topMonth = d3.max(topCategoriesByYear, (d) => d3.max(d.values, (y) => y.values) )
    var quoteData = [
        { date: "21 January 2014", quote: '<span class="redacted redacted-1">[REDACTED1]</span> approached <span class="redacted redacted-2">[REDACTED2]</span> save the children and informed that a CSO had choked his son', ref: "SCA14.0042" },
        { date: "21 February 2014", quote: '<span class="redacted redacted-1">[REDACTED1]</span> reported that he wished to "kill himself"', ref: "SCA14.0069" },
        { date: "4 April 2014", quote: '<span class="redacted">[REDACTED]</span> told caseworker that she had been told to "fuck off" by security staff after advising them she had missed out on medication', ref: "SCA14.0164" },
        { date: "3 July 2014", quote: '<span class="redacted">[REDACTED]</span> disclosed that her son <span class="redacted">[REDACTED]</span> has been making threats to kill himself, has lost weight, refusing to eat and is crying daily.', ref: "SCA14.0401" }
    ]

    var data =  getData()
    var years = [
        {year: 2015, selected: true},
        {year: 2014},
        {year: 2013}
    ]

    // ractive.DEBUG = false;
    var ractive = new Ractive({
        events: { tap: ractiveTap },
        el: '#gridContainer',
        data:{
            nauruData:data,
            dataEmpty: data.length < 1,
            updateMessage:false, 
            years: years,
            categories: nauruCategoryMap.keys(),
            topCategories: getTopCategories()
        },
        incidentRating:incidentRating,
        category: category,
        template: gridItem,
        decorators: {
            tooltip: Tooltip
        }
    })

    drawBars()

    ractive.on('showDetail', (d) => showModal(d.context))

    //Load modal from url param
    var hash = getHash()
    var dataMapped = d3.map(nauruJson, (d) => d.id)

    if(hash) {
        console.log(hash)
        console.log(dataMapped.get(hash))
        showModal(dataMapped.get(hash))
    }

    ractive.observe('incidentRating', function ( newValue, oldValue ) {
        console.log( 'changed from', oldValue, 'to', newValue );
        incidentRating = newValue;
        if (oldValue != undefined) {
            ractive.set('nauruData',getData())
            ractive.set('dataEmpty', filteredData < 1)
        }
    });

    ractive.observe('category', function ( newValue, oldValue ) {
        console.log( 'changed from', oldValue, 'to', newValue );
        category = newValue;
        if (oldValue != undefined) {
            ractive.set('nauruData',getData())
            ractive.set('dataEmpty', filteredData < 1)
        }
    });

    ractive.on('changeYear', (e) => {
        year = e.context.year
        ractive.set('updateMessage', true)
        ractive.set('years.*.selected', false)
        ractive.set(`years.${e.index.i}.selected`, true)
        ractive.set('nauruData',getData())
        ractive.set('dataEmpty', filteredData < 1)
        ractive.set('topCategories', getTopCategories())
    })

    function drawBars() {
        var barData = nauruYearMonth[0].values
        console.log('bars', barData)
        var contain = d3.select(".month-bars")
        var monthFormat = d3.time.format("%B")
        var monthDisplay = d3.time.format("%b")
        var barWidth = Math.floor(100/barData.length)
        var dateExtent = d3.extent(barData, (d) => monthFormat.parse(d.key))
        console.log(dateExtent)
        var x = d3.time.scale().domain(dateExtent).range([0, 100])

        var tick = contain.selectAll("span.tick")
            .data(x.ticks(5))
            .enter()
            .append("span")
            .attr("class", "tick")
            .style("left", (d) => `${x(d)}%`)
            .text((d) => monthDisplay(d))

        contain.selectAll("div.bar")
            .data(barData)
            .enter()
            .append("div")
            .attr("class", "bar")
            .style("height", (d) => `${d.values.length}px`)
            .style("width", `${barWidth}%`)
            .style("left", (d,i) => `${x(monthFormat.parse(d.key))}%`)            
    }

    function getTopCategories() {
        return topCategoriesMap.get(year).values.slice(0, 8)
    }

    function getData() {
        filteredData = nauruJson.filter(function(d) { return d.year == year })

        if (incidentRating != 'All') {
            filteredData = filteredData.filter(function(d) { return d.riskRating == incidentRating })
        }

        if (category != 'All') {
            filteredData = filteredData.filter(function(d) { return d.type == category})
        }

        filteredYearMonth = d3.nest()
                .key(function(d) { return d.year; })
                .key(function(d) { return d.month; })
                .entries(filteredData);       

        filteredYearMonth.forEach((d) => {
            var quotes = quoteData.filter((q) => { return getYear(dateDisplay.parse(q.date)) === d.key })
            d.values.forEach((m) => {
                m.quote = quotes.filter((q) => { return getMonth(dateDisplay.parse(q.date)) === m.key })[0]
            })
        });

        filteredYearMonth.sort(function (a,b) {
            return getYear.parse(b.key) - getYear.parse(a.key);
        });
    
        filteredYearMonth.forEach( function(d) {
            d.values.sort(function (a,b) {
                return getMonth.parse(a.key) - getMonth.parse(b.key);
            });
        });

        return filteredYearMonth                
    }    

    function updateURL(index) {
        var urlString = `#incident=${index}`
        
        if ( window.self !== window.top ) {
            iframeMessenger.navigate(urlString);
            // iframeMessenger.getLocation(function(parLocation) {
            // linkURL = parLocation['href'];
            //     tweetLinkURL = "https://twitter.com/intent/tweet?text=Here's+my+plan+for+tax+reform+in+Australia:+&url=" + parLocation['origin'] + parLocation['pathname'] + "%23" + urldata.join(",") + "&hashtags=ruleinruleout";
            //     ractive.set('tweetLinkURL',tweetLinkURL);
            //     ractive.set('linkURL',linkURL);
            // });
        }
        else {
            window.location.hash = urlString;
            // linkURL = window.location.origin + window.location.pathname + "#" + urldata.join(",");
            // tweetLinkURL = "https://twitter.com/intent/tweet?text=Here's+my+plan+for+tax+reform+in+Australia:+&url=" + window.location.origin + window.location.pathname + "%23" + urldata.join(",") + "&hashtags=ruleinruleout";
            // ractive.set('tweetLinkURL',tweetLinkURL);
            // ractive.set('linkURL',linkURL);            
        }
    }

    function getHash() {
        if (window.self !== window.top) 
            { var hash = iframeMessenger.getLocation.hash }
        else if (window.location.hash) {
            var hash = window.location.hash.split('incident=')[1].split('&')[0]
        }

        if (hash) {
            return hash
        }
        else {
            return false
        }

    }

    function showModal(data) {
        var modal = new Modal({
            transitions: { fade: ractiveFade },
            events: { tap: ractiveTap },
            data: {details: data}
        });
        updateURL(data.id)
    }
}
