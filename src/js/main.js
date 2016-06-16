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
    var downgraded = "All"
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

    var nauruByYear = d3.map(nauruYearMonth, (d) => d.key)

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
        downgraded: downgraded,
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

    ractive.observe('downgraded', function ( newValue, oldValue ) {
        console.log( 'changed from', oldValue, 'to', newValue );
        downgraded = newValue;
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
        updateBars()
    })

    function drawBars() {
        var barData = nauruByYear.get(year).values
        var dataByMonth = d3.map(barData, (d) => d.key)
        var contain = d3.select(".month-bars")
        var monthFormat = d3.time.format("%B")
        var monthDisplay = d3.time.format("%b")
        var justMonth = d3.time.format("%-m")
        var totalWidth = contain.node().getBoundingClientRect().width
        var dateData = d3.time.months(justMonth.parse("1"), d3.time.month.offset(justMonth.parse("12"),1))
        console.log(dateData)
        var gap = 4
        var barWidth = Math.floor(totalWidth/12) - gap
        var x = d3.time.scale().domain([justMonth.parse("1"), justMonth.parse("12")]).range([0, totalWidth - barWidth]).nice()
        var y = d3.scale.linear().domain([0, topMonth]).range([0,70])

        contain.selectAll("span.tick, div.bar").remove()

        var tick = contain.selectAll("span.tick")
            .data(x.ticks(10))
            .enter()
            .append("span")
            .attr("class", "tick")
            .style("left", (d) => `${x(d)}px`)
            .style("opacity", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? 1 : 0.5
            })
            .text((d) => monthDisplay(d))

        contain.selectAll("div.bar")
            .data(dateData)
            .enter()
            .append("div")
            .attr("class", "bar")
            .style("height", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                console.log(d, result)
                return result ? `${Math.ceil(y(result.values.length))}px` : `0px`
            })
            .style("width", `${barWidth}px`)
            .style("left", (d,i) => `${x(d)}px`)            
    }

    function updateBars() {
        var barData = nauruByYear.get(year).values
        var dataByMonth = d3.map(barData, (d) => d.key)
        var y = d3.scale.linear().domain([0, topMonth]).range([0,70])
        var monthFormat = d3.time.format("%B")
        
        d3.select(".month-bars").selectAll(".tick")
            .transition()
            .style("opacity", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? 1 : 0.6
            })

        d3.select(".month-bars").selectAll("div.bar")
            .transition()
            .style("height", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? `${Math.ceil(y(result.values.length))}px` : `0px`
            })
    }


    function getTopCategories() {
        var topCat = topCategoriesMap.get(year).values
        return [topCat.slice(0, 4), topCat.slice(4, 8)]
    }

    function getData() {
        filteredData = nauruJson.filter(function(d) { return d.year == year })

        if (incidentRating != 'All') {
            filteredData = filteredData.filter(function(d) { return d.riskRating == incidentRating })
        }

        if (category != 'All') {
            filteredData = filteredData.filter(function(d) { return d.type == category})
        }

        if (downgraded != 'All') {
            filteredData = filteredData.filter(function(d) { return d.downgraded == downgraded})
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
