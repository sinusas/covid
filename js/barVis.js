/* * * * * * * * * * * * * *
*      class BarVis        *
* * * * * * * * * * * * * */


class BarVis {

    constructor(parentElement, covidData, usaData, descending){
        this.parentElement = parentElement;
        this.covidData = covidData;
        this.usaData = usaData;
        this.descending = descending;
        this.displayData = [];

        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis(){
        let vis = this;

        vis.margin = {top: 20, right: 20, bottom: 30, left: 50};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append('g')
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // add title
        vis.svg.append('g')
            .attr('class', 'title bar-title')
            .append('text')
            .text(vis.descending ? 'Top Ten States': "Bottom Ten States")
            .attr('transform', `translate(${vis.width / 2}, 10)`)
            .attr('text-anchor', 'middle');

        // tooltip
        vis.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .attr("id", `${vis.parentElement}-tooltip`)

        vis.x = d3.scaleBand()
            .rangeRound([0, vis.width])
            .paddingInner(0.1);

        vis.y = d3.scaleLinear()
            .range([vis.height, 0])

        this.wrangleData();
    }

    wrangleData(){
        let vis = this
        // Pulling this straight from dataTable.js
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0) {
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            vis.covidData.forEach(row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime()) {
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d => d.state), ([key, value]) => ({key, value}))
        
        // init final data structure in which both data sets will be merged into
        vis.stateInfo = []

        // merge
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
                    relDeaths: (newDeathsSum / population * 100)
                }
            )
        })


        if (vis.descending){
            vis.stateInfo.sort((a,b) => {return b[selectedCategory] - a[selectedCategory]})
        } else {
            vis.stateInfo.sort((a,b) => {return a[selectedCategory] - b[selectedCategory]})
        }

        vis.topTenData = vis.stateInfo.slice(0, 10);

        vis.y.domain([0,d3.max(vis.topTenData, d=> d[selectedCategory])]);
        vis.x.domain(vis.topTenData.map(d=> d.state));

        vis.updateVis()

    }

    updateVis(){
        let vis = this;

        vis.bars = vis.svg.selectAll("rect")
            .data(vis.topTenData);

        vis.bars.exit().remove();

        vis.animatedBars = vis.bars.enter()
            .append("rect")
            .merge(vis.bars)
            .attr("class", "bar")
            .attr("x", d=> vis.x(d.state))
            .attr("width", vis.x.bandwidth())
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke-width', '2px')
                    .attr('stroke', 'black')
                    .style("fill", 'red');
                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px")
                    .html(`
                        <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
                            <h3>${d.state}</h3>
                            <h4>Population: <strong>${d.population.toLocaleString()}</strong></h4>
                            <h4>Cases (absolute): <strong>${d.absCases.toLocaleString()}</strong></h4>
                            <h4>Deaths (absolute): <strong>${d.absDeaths.toLocaleString()}</strong></h4>
                            <h4>Cases (relative): <strong>${d.relCases.toFixed(2)}%</strong></h4>
                            <h4>Deaths (relative): <strong>${d.relDeaths.toFixed(2)}%</strong></h4>
                        </div>
                    `)
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .attr('stroke-width', '0px')
                    .style('fill','darkred')

                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``)
            })


        if (vis.xAxis == null) {
            createAxes();
            vis.animatedBars
                .attr("y", vis.height)
                .transition()
                .duration(1800)
                .attr("y", d=> vis.y(d[selectedCategory]))
                .attr("height", d=> vis.height - vis.y(d[selectedCategory]));
        } else {
            vis.stateLabels = vis.svg.select(".x-axis")
                .attr("opacity", 1)

            vis.stateLabels.transition()
                .ease(d3.easePolyIn)
                .duration(1500)
                .attr("opacity", 0)

            vis.stateLabels.call(vis.xAxis)
                .attr("opacity", 0);

            vis.stateLabels.transition()
                .delay(100)
                .ease(d3.easePolyOut)
                .duration(1500)
                .attr("opacity", 1);

            vis.animatedAxis = vis.svg.select(".y-axis")
                .attr("opacity", 1)

            vis.animatedAxis.transition()
                .ease(d3.easePolyIn)
                .duration(1500)
                .attr("opacity", 0)

            vis.animatedAxis.call(vis.yAxis)
                .attr("opacity", 0);

            vis.animatedAxis.transition()
                .delay(100)
                .ease(d3.easePolyOut)
                .duration(1500)
                .attr("opacity", 1);

            vis.svg.select(".y-axis-title")
                .text(selectedCategory);

            vis.animatedBars.transition()
                .duration(1200)
                .attr("y", d=> vis.y(d[selectedCategory]))
                .attr("height", d=> vis.height - vis.y(d[selectedCategory]))


        }

        function createAxes() {
            vis.xAxis = d3.axisBottom()
                .scale(vis.x);
            vis.yAxis = d3.axisLeft()
                .scale(vis.y);

            let xPos= {
                x: Math.round(vis.width / 2),
                y: Math.round(vis.margin.bottom * .8)
            };
            let yPos = {
                x: Math.round(vis.margin.left * -.8),
                y: Math.round(vis.height / 2)
            };
            vis.svg.append("g")
                .attr("class", "axis x-axis")
                .call(vis.xAxis)
                .attr("transform", "translate(0," + vis.height + ")")
                .append("text")
                .attr("x", xPos.x)
                .attr("y", xPos.y)
                .attr("class", "axis-title x-axis-title")
                .text("Company");

            vis.svg.append("g")
                .attr("class", "axis y-axis")
                .call(vis.yAxis)
                .append("text")
                .attr("x", yPos.x)
                .attr("y", yPos.y)
                .attr("transform", "rotate(-90, " + yPos.x + ", " + yPos.y + ")")
                .attr("class", "axis-title y-axis-title")
                .text("stores");
        }
    }



}