import reqwest from 'reqwest'
import mainHTML from './text/main.html!text'
import share from './lib/share'
import Ractive from 'ractive'
import d3 from 'd3'
import nauruData from './text/nauru.json!text'

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
    var getMonth = d3.time.format("%B");
    var getYear = d3.time.format("%Y");
    var nauruJson = JSON.parse(nauruData);
    var year = "All";
    var filteredData,filteredYearMonth;
    var incidentRating = "All";
    var sortYear = function (a, b) { d3.ascending(getYear.parse(a), getYear.parse(b)) };
    var sortMonth = function (a, b) { d3.ascending(getMonth.parse(a), getMonth.parse(b)) };
    nauruJson.forEach( function(d) {
        d.date = dateFormat.parse(d.date);
        d.month = getMonth(d.date);
        d.year = getYear(d.date);
    });

    console.log(nauruJson);

    //Nest by year then Month

    var nauruYearMonth = d3.nest()
        .key(function(d) { return d.year; })
        .key(function(d) { return d.month; })
        .entries(nauruJson);

    //Sort by year then month    

    nauruYearMonth.sort(function (a,b) {
        return getYear.parse(a.key) - getYear.parse(b.key);
    });
    
    nauruYearMonth.forEach( function(d) {
        d.values.sort(function (a,b) {
            return getMonth.parse(a.key) - getMonth.parse(b.key);
        });
    });

    console.log(nauruYearMonth);    

    // ractive.DEBUG = false;
    var ractive = new Ractive({
        el: '#gridContainer',
        data:{nauruData:nauruYearMonth},
        year:year,
        incidentRating:incidentRating,
        template: '#template'    
    })

    

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

    

    // function filterData(year,category,)


}
