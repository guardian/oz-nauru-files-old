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
import nauruData from './data/nauru.json!json'
import data2013 from './data/data2013.json!json'
import data2014 from './data/data2014.json!json'
import data2015 from './data/data2015.json!json'

var shareFn = share('Interactive title', 'http://gu.com/p/URL', '#Interactive');

export function init(el, context, config, mediator) {
    el.innerHTML = mainHTML.replace(/%assetPath%/g, config.assetPath);
    // reqwest({
    //     url: '',
    //     type: 'json',
    //     crossOrigin: true,
    //     success: (data) => console.log(data)
    // });
    var dateFormat = d3.time.format("%Y-%m-%d");
    var dateDisplay = d3.time.format("%d %B %Y");
    var getMonth = d3.time.format("%B");
    var getYear = d3.time.format("%Y");
    var nauruJson = nauruData;
    var year = "All";
    var filteredData,filteredYearMonth;
    var incidentRating = "All";
    var sortYear = function (a, b) { d3.ascending(getYear.parse(a), getYear.parse(b)) };
    var sortMonth = function (a, b) { d3.ascending(getMonth.parse(a), getMonth.parse(b)) };

    nauruJson.forEach( function(d,i) {
        d.id = i
        d.date = dateFormat.parse(d.date);
        d.dateDisplay = dateDisplay(d.date)
        d.month = getMonth(d.date);
        d.year = getYear(d.date);
    });

    var combineData = data2013.concat(data2014,data2015)

    var combined = d3.nest()
        .key((d) => d.category ? d.category.toLowerCase() : null)
        .entries(combineData)

    combined.sort((a,b) => d3.descending(a.values.length, b.values.length))

    combined.forEach((d) => {
        console.log(d.key, d.values.length)
    })

    var quoteData = [
        { date: "21 January 2014", quote: '<span class="redacted redacted-1">[REDACTED1]</span> approached <span class="redacted redacted-2">[REDACTED2]</span> save the children and informed that a CSO had choked his son', ref: "SCA14.0042" },
        { date: "21 February 2014", quote: '<span class="redacted redacted-1">[REDACTED1]</span> reported that he wished to "kill himself"', ref: "SCA14.0069" },
        { date: "4 April 2014", quote: '<span class="redacted">[REDACTED]</span> told caseworker that she had been told to "fuck off" by security staff after advising them she had missed out on medication', ref: "SCA14.0164" },
        { date: "3 July 2014", quote: '<span class="redacted">[REDACTED]</span> disclosed that her son <span class="redacted">[REDACTED]</span> has been making threats to kill himself, has lost weight, refusing to eat and is crying daily.', ref: "SCA14.0401" }
    ]

    console.log(nauruJson);

    //Nest by year then Month

    var nauruYearMonth = d3.nest()
        .key(function(d) { return d.year; })
        .key(function(d) { return d.month; })
        .entries(nauruJson);

    var dataMapped = d3.map(nauruJson, (d) => d.id)

    //Sort by year then month    

    nauruYearMonth.sort(function (a,b) {
        return getYear.parse(a.key) - getYear.parse(b.key);
    });
    
    nauruYearMonth.forEach((d) => {
        var quotes = quoteData.filter((q) => { return getYear(dateDisplay.parse(q.date)) === d.key })
        d.values.forEach((m) => {
            m.quote = quotes.filter((q) => { return getMonth(dateDisplay.parse(q.date)) === m.key })[0]
            console.log(m.quote)
        })
        d.values.sort(function (a,b) {
            return getMonth.parse(a.key) - getMonth.parse(b.key);
        });
    });

    console.log(nauruYearMonth);    

    // ractive.DEBUG = false;
    var ractive = new Ractive({
        events: { tap: ractiveTap },
        el: '#gridContainer',
        data:{nauruData:nauruYearMonth},
        year:year,
        incidentRating:incidentRating,
        template: gridItem,
        decorators: {
            tooltip: Tooltip
        }
    })

    ractive.on('showDetail', (d) => showModal(d.context))

    //Load modal from url param
    var hash = getHash()

    if(hash) {
        console.log(hash)
        console.log(dataMapped.get(hash))
        showModal(dataMapped.get(hash))
    }


    function filterData() {

        filteredData = nauruJson;

        if (year != 'All' ) {
            filteredData = nauruJson.filter(function(d) { return d.year == year })
        }

        if (incidentRating != 'All') {
            filteredData = filteredData.filter(function(d) { return d.riskRating == incidentRating })
        }

        console.log('filteredData',filteredData);
        console.log('nauruData',nauruJson);

        filteredYearMonth = d3.nest()
                .key(function(d) { return d.year; })
                .key(function(d) { return d.month; })
                .entries(filteredData);       

        filteredYearMonth.sort(function (a,b) {
            return getYear.parse(a.key) - getYear.parse(b.key);
        });
    
        filteredYearMonth.forEach( function(d) {
            d.values.sort(function (a,b) {
                return getMonth.parse(a.key) - getMonth.parse(b.key);
            });
        });        

        ractive.set('nauruData',filteredYearMonth);
        
    }

    ractive.observe('year', function ( newValue, oldValue ) {
        console.log( 'changed from', oldValue, 'to', newValue );
        year = newValue;
        if (oldValue != undefined) {
            filterData();
        }
        
    });

    ractive.observe('incidentRating', function ( newValue, oldValue ) {
        console.log( 'changed from', oldValue, 'to', newValue );
        incidentRating = newValue;
        if (oldValue != undefined) {
            filterData();
        }
    });

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

    

    // function filterData(year,category,)


}
