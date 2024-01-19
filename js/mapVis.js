/* * * * * * * * * * * * * *
*          MapVis          *
* * * * * * * * * * * * * */


class MapVis {

    constructor(parentElement, geoData, covidData, usaData) {
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.covidData = covidData;
        this.usaData = usaData;
        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis() {
        let vis = this;

        // margin conventions
        vis.margin = {top: 10, right: 50, bottom: 10, left: 50};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;


        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);

        vis.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .attr("id", `${vis.parentElement}-tooltip`)

        vis.viewpoint = {"width": 975, "height": 610};
        vis.zoom = vis.width / vis.viewpoint.width;

        vis.map = vis.svg.append("g")
            .attr("class", "states")
            .attr("transform", `scale(${vis.zoom} ${vis.zoom})`);

        vis.path = d3.geoPath()
            .projection(vis.projection);

        vis.country = topojson.feature(vis.geoData, vis.geoData.objects.states).features;

        vis.states = vis.map.selectAll(".state")
            .data(vis.country)
            .enter().append("path")
                .attr("class", "state")
                .attr("d", vis.path);

        vis.defs = vis.svg.append("defs")  // informed by https://www.freshconsulting.com/insights/blog/d3-js-gradients-the-easy-way/

        vis.gradient = vis.defs.append("linearGradient")
            .attr("id", "legendGradient")
            .attr("x1", "0%")
            .attr("x2", "100%")

        vis.gradient.append("stop")
            .attr("class", "start")
            .attr("offset", "0%")
            .attr("stop-color", "white")
            .attr("stop-opacity", 1)

        vis.gradient.append("stop")
            .attr("class", "end")
            .attr("offset", "100%")
            .attr("stop-color", "darkred")
            .attr("stop-opacity", 1)

        vis.legend = vis.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${vis.width *.625}, 0)`);

        vis.legend.append("rect")
            .attr("width", vis.width * .25)
            .attr("height", 25)
            .attr("fill", "url(#legendGradient)")

        vis.legend.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", 0).attr("y2", 30)
            .attr("stroke", "black")

        vis.legend.append("line")
            .attr("x1", vis.width * .25).attr("y1", 0)
            .attr("x2", vis.width * .25).attr("y2", 30)
            .attr("stroke", "black")

        vis.legend.append("text")
            .attr("x", 0).attr("y", 45)
            .attr("text-anchor", "middle")
            .text("0")

        vis.maxValue = vis.legend.append("text")
            .attr("x", vis.width * .25).attr("y", 45)
            .attr("text-anchor", "middle")
            .text("")

        vis.wrangleData();
    }

    wrangleData() {
        let vis = this;

        let filteredData = [];

        if (selectedTimeRange.length !== 0) {
            vis.covidData.forEach(row => {
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime()) {
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }
        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d => d.state), ([key, value]) => ({key, value}))

        // have a look
        vis.stateInfo = [];

        covidDataByState.forEach(state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            vis.usaData.forEach(row => {
                if (row.state === stateName) {
                    population += +row["2020"].replaceAll(',', '');
                }
            })

            // calculate new cases by summing up all the entries for each state
            state.value.forEach(entry => {
                newCasesSum += +entry['new_case'];
                newDeathsSum += +entry['new_death'];
            });

            // populate the final data structure
            vis.stateInfo.push(
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum / population * 100),
                    relDeaths: (newDeathsSum / population * 100),
                }
            )
        })

        vis.stateInfoByState = {};
        vis.stateInfo.forEach(function(d){vis.stateInfoByState[d['state']]=d});


        vis.geoData.objects.states.geometries.forEach(d=> {

        })
        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        vis.mapColor = d3.scaleLinear()
            .domain([0, d3.max(vis.stateInfo.map(d => d[selectedCategory]))])
            .range(["white", "darkred"]);

        vis.maxValue
            .text(d3.max(vis.stateInfo.map(d => d[selectedCategory])).toLocaleString());

        vis.states.enter().merge(vis.states)
            .style('fill', function(d) {return vis.mapColor(
                vis.stateInfoByState[d.properties.name][selectedCategory]
            );})
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke-width', '2px')
                    .attr('stroke', 'black')
                    .style("fill", 'red');
                let thisState = vis.stateInfoByState[d.properties.name];
                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px")
                    .html(`
                        <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
                            <h3>${d.properties.name}</h3>
                            <h4>Population: <strong>${thisState.population.toLocaleString()}</strong></h4>
                            <h4>Cases (absolute): <strong>${thisState.absCases.toLocaleString()}</strong></h4>
                            <h4>Deaths (absolute): <strong>${thisState.absDeaths.toLocaleString()}</strong></h4>
                            <h4>Cases (relative): <strong>${thisState.relCases.toFixed(2)}%</strong></h4>
                            <h4>Deaths (relative): <strong>${thisState.relDeaths.toFixed(2)}%</strong></h4>
                        </div>
                    `)
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .attr('stroke-width', '0px')
                    .style('fill', function(d) {return vis.mapColor(
                        vis.stateInfoByState[d.properties.name][selectedCategory]
                    );})

                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``)
            })

    }

}