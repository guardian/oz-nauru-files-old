import reqwest from 'reqwest'
import jquery from 'jquery'
import iframeMessenger from 'guardian/iframe-messenger'
import mainHTML from './text/main.html!text'
import template from './text/template.html!text'
import incidentModal from './text/modal.html!text'
import aboutModal from './text/aboutModal.html!text'
import reportModal from './text/reportModal.html!text'
import share from './lib/share'
import Ractive from 'ractive'
import ractiveFade from 'ractive-transitions-fade'
import ractiveTap from 'ractive-events-tap'
import d3 from 'd3'
import Modal from './modal'
import Tooltip from './tooltip'
import nauruData from './data/nauru2.json!json'
import quotes from './data/quotes.json!json'
import aos from 'aos'

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
    var aosOpts = { disable: 'mobile' }

    nauruJson.forEach( function(d,i) {
        d.id = cleanID(d.reference)
        d.date = dateFormat.parse(d.date);
        d.dateDisplay = dateDisplay(d.date)
        d.month = getMonth(d.date);
        d.year = getYear(d.date);
    });
    var dataMapped = d3.map(nauruJson, (d) => d.id)

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
    // var quoteData = [
    //     { date: "21 January 2014", quote: '<span class="redacted redacted-1">[REDACTED1]</span> approached <span class="redacted redacted-2">[REDACTED2]</span> save the children and informed that a CSO had choked his son', ref: "SCA14.0042" },
    //     { date: "21 February 2014", quote: '<span class="redacted redacted-1">[REDACTED1]</span> reported that he wished to "kill himself"', ref: "SCA14.0069" },
    //     { date: "4 April 2014", quote: '<span class="redacted">[REDACTED]</span> told caseworker that she had been told to "fuck off" by security staff after advising them she had missed out on medication', ref: "SCA14.0164" },
    //     { date: "3 July 2015", quote: '<span class="redacted">[REDACTED]</span> disclosed that her son <span class="redacted">[REDACTED]</span> has been making threats to kill himself, has lost weight, refusing to eat and is crying daily.', ref: "SCA14.0401" }
    // ]
    console.log(quotes)
    var quoteData = quotes
    quoteData.forEach((d) => {
        d.id = cleanID(d.ref)
        var e = dataMapped.get(d.id)
        if (e) e.hasQuote = true
        // console.log(d.id, dataMapped.get(d.id))
    })

    nauruJson = dataMapped.values()

    var data =  getData()
    var years = [
        {year: 2015, selected: true},
        {year: 2014},
        {year: 2013}
    ]

    // ractive.DEBUG = false;
    var ractive = new Ractive({
        events: { tap: ractiveTap },
        el: '.interactive-container',
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
        template: template,
        decorators: {
            tooltip: Tooltip
        }
    })
    aos.init(aosOpts)

    drawBars()

    ractive.on('showDetail', (d) => showModal(d.context))
    ractive.on('showAbout', (d) => showAbout())

    //Load modal from url param
    var hash = getHash()

    if(hash) {
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
        aos.init(aosOpts)
    });

    ractive.observe('downgraded', function ( newValue, oldValue ) {
        console.log( 'changed from', oldValue, 'to', newValue );
        downgraded = newValue;
        if (oldValue != undefined) {
            ractive.set('nauruData',getData())
            ractive.set('dataEmpty', filteredData < 1)
        }
        aos.init(aosOpts)
    });

    ractive.on('changeYear', (e) => {
        year = e.context.year
        ractive.set('years.*.selected', false)
        ractive.set(`years.${e.index.i}.selected`, true)
        ractive.set('updateMessage', true)
        ractive.set('nauruData',getData())
        ractive.set('dataEmpty', filteredData < 1)
        ractive.set('topCategories', getTopCategories())
        updateBars()
        aos.init(aosOpts)

    })
    function drawBars() {
        var barData = nauruByYear.get(year).values
        var dataByMonth = d3.map(barData, (d) => d.key)
        var contain = d3.select(".month-bars")
        var monthFormat = d3.time.format("%B")
        var monthDisplay = d3.time.format("%b")
        var justMonth = d3.time.format("%-m")
        // var totalWidth = contain.node().getBoundingClientRect().width
        var totalWidth = 100
        var dateData = d3.time.months(justMonth.parse("1"), d3.time.month.offset(justMonth.parse("12"),1))
        var gap = 2
        var barWidth = 6
        var x = d3.time.scale().domain([justMonth.parse("1"), justMonth.parse("12")]).range([3, totalWidth - barWidth - 3]).nice()
        var y = d3.scale.linear().domain([0, topMonth]).range([0,70])

        contain.selectAll("span.tick, div.bar").remove()
        
        var value = contain.append("div")
            .attr("class", "value")
            .style("width", `${barWidth}%`)


        var tick = contain.selectAll("span.tick")
            .data(x.ticks(10))
            .enter()
            .append("span")
            .attr("class", "tick")
            .style("left", (d) => `${x(d)}%`)
            .style("opacity", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? 1 : 0.5
            })
            .text((d) => monthDisplay(d))

        var bar = contain.selectAll("div.bar")
            .data(dateData)
            .enter()
            .append("div")
            .attr("class", "bar")
            .style("width", `${barWidth}%`)
            .style("left", (d,i) => `${x(d)}%`) 
            .on("mouseover", function(){ d3.select(this).select('.value').style("display", "block")})
            .on("mouseout", function(){ d3.select(this).select('.value').style("display", "none")})


        var fill = bar.append("div")
            .attr("class", "fill")
            .style("height", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? `${Math.ceil(y(result.values.length))}px` : `0px`
            })

        var value = bar.append("div")
            .attr("class", "value")
            .text((d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? result.values.length : ''
            })
            .style("bottom", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? `${Math.ceil(y(result.values.length)) + 20}px` : '0px'
            })

    }

    function cleanID(id) {
        var cleanID = id.replace(/[\. ]+/g, '').toLowerCase()
        return cleanID
    }

    function updateBars() {
        var barData = nauruByYear.get(year).values
        var dataByMonth = d3.map(barData, (d) => d.key)
        var y = d3.scale.linear().domain([0, topMonth]).range([0,70])
        var monthFormat = d3.time.format("%B")
        var value = d3.select('.month-bars .value')

        d3.select(".month-bars").selectAll(".tick")
            .transition()
            .style("opacity", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? 1 : 0.6
            })

        var bar = d3.select(".month-bars").selectAll("div.bar")

        bar.select('.fill').transition()
            .style("height", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? `${Math.ceil(y(result.values.length))}px` : `0px`
            })

        bar.select('.value')
            .text((d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? result.values.length : ''
            })
            .style("bottom", (d) => {
                var result = dataByMonth.get(monthFormat(d))
                return result ? `${Math.ceil(y(result.values.length)) + 20}px` : '0px'
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
        }
        else {
            window.location.hash = urlString;        
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

    function showReport(data) {
        var modal = new Modal({
            transitions: { fade: ractiveFade },
            events: { tap: ractiveTap },
            data: {
                incident: data
            },
            template: reportModal
        });

        $("#nauru-report-submit").click(function() {
            $("#nauru-report-form").submit();
            modal.fire("close")
            $("#submit-msg").css('display', 'block')
        });
    }

    function showModal(data) {
        var linkURL = window.location.origin + window.location.pathname
        var urlString = `#incident=${data.id}`
        var tweetURL = `https://twitter.com/intent/tweet?text=Three+years+worth+of+incidents+from+the+Nauru+detention+centre+&url=${linkURL}${urlString}`;
        var modal = new Modal({
            transitions: { fade: ractiveFade },
            events: { tap: ractiveTap },
            data: {
                details: data,
                tweetURL: tweetURL
                },
            template: incidentModal
        });
        modal.on('showReport', function(d) { showReport(d.context)})

        updateURL(data.id)
    }

    function showAbout() {
        var modal = new Modal({
            transitions: { fade: ractiveFade },
            events: { tap: ractiveTap },
            template: aboutModal
        });
    }

}
