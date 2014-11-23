function build_smash_power_rankings(select_target, svg_height, platform, group) {

    var smash_data_set = smash_data[platform]

    // Define size of graph area
    var margin = {top: 30, right: 80, bottom: 50, left: 110},
            width = 960 - margin.left - margin.right,
            height = svg_height - margin.top - margin.bottom;

    // Define X/Y range for domain->range mappings
    var x = d3.scale.linear()
            .range([0, width]);

    var y = d3.scale.linear()
            .range([0, height]);

    // X-Axis along bottom of chart
    var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");

    // Y-Axis displayed by right edge of chart
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("right")
        .ticks(5);

    // Template (I guess?) for making lines. We'll have one line per entry
    var line = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.ranking); });

    // Outer container SVG element to enable responsive magic
    var svg_root = d3.select(select_target).append("svg")
        .attr("viewBox", "0 0 960 " + svg_height)
        .attr("preserveAspectRatio", "none");

    // SVG that will be used for D3 operations
    var svg = svg_root.append("svg")
        .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add one tick per date entry to x-axis
    xAxis.ticks(smash_data_set.dates.length)
        .tickFormat(function(d) { return smash_data_set.dates[d]; });


    // Utility to return color stored in entry or pick one if it's not defined
    // Pretty hacky and special cased code. :( Oh well!
    var color_for_entry = function(entry) {
        if (entry.hasOwnProperty('color'))
            return entry.color;

        // Set of 26 colors that works fairly well together. 
        // Colorbrewer.js defines a lot of color sets, but we need more colors
        var ssbm_colors = [ 
            "#F0A3FF","#0075DC","#FFA405","#4C005C","#FF0010","#8F7C00","#990000","#2BCE48","#FFCC99",
            "#808080","#5EF1F2","#9DCC00","#ffed6f","#00998F","#003380","#94FFB5","#fb9a99","#FF5005",
            "#005C31","#b15928","#426600","#FFA8BB","#191919","#E6E62E","#C20088","#740AFF" 
        ]; 

        var colors = ssbm_colors;
        var index = smash_data_set.groups[group].indexOf(entry.name);   // This is the hacky part :(
        if (index < 0)
            index = 0;
        else if (index >= colors.length)
            index = index % colors.length;
        return colors[index];
    };

    /* Output format of all_rankings:
        [
            {
                "character":"pikachu",
                "color":"#ffed6f",
                "values:[
                    { "date": 0, "ranking":13 },
                    { "date": 1, "ranking":17 },
                    { "date": 2, "ranking":16 },
                ]
            }
        ]
    */
    var all_rankings = smash_data_set.characters
        .filter(function(char_entry) { 
            return smash_data_set.groups[group].indexOf(char_entry.name) != -1; })  // filter out chars not in group
        .map(function(char_entry, index, arr) {
            return {
                character: char_entry.name,
                color: color_for_entry(char_entry),
                values: char_entry.rankings
                    .map(function(ranking, index){
                        return { date: index, ranking: ranking }})  // transform into d3 friendly format
                    .filter(function(value_entry) {
                        return value_entry.ranking != -1; }) // filter out entries where rank is -1
            }
        });

    // Remember, domain->range. Define x axis domain
    // Ouput: [earliest_date, latest_date]
    var x_domain = [
        d3.min(all_rankings, function(c) { return d3.min(c.values, function(v) { return v.date; }); }),
        d3.max(all_rankings, function(c) { return d3.max(c.values, function(v) { return v.date; }); })
    ];
    x.domain(x_domain);

    // Define y axis domain
    // Output: [1, highest rank in unfiltered character dataset (varies by game version)]
    var y_domain = [1, d3.max(smash_data_set.characters, function(c) { return d3.max(c.rankings); }) ];
    y.domain(y_domain);


    // Define domain->range for character_name -> color
    var colors = d3.scale.ordinal()
                    .domain(smash_data_set.characters.map(function(entry) { return entry.name; }))
                    .range(smash_data_set.characters.map(function(entry) { return color_for_entry(entry);} ));



    // Setup x-axis
    svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + (height + 10) + ")")    // shifted down slightly
            .call(xAxis)
            .selectAll(".tick text")
                .style("text-anchor", "mid");   // default is mid, but start/end are other choices

    // Setup y-axis
    svg.append("g")
            .attr("class", "y axis axisRight")
            .attr("transform", "translate( " + (width + 10) + ",0)")
            .call(yAxis)
        .append("text")
            .attr("y", -14)
            .style("text-anchor", "left")
            .text("Ranking");

    // Bind all_rankings data to DOM
    var character_ranks = svg.selectAll(".character_ranks")
            .data(all_rankings)
        .enter().append("g")
            .attr("class", "character_ranks");

    // Add a colored line for each character
    character_ranks.append("path")
            .attr("class", "rank_line")
            .attr("d", function(d) { return line(d.values); })
            .style("stroke", function(d) { return colors(d.character); })

    // Add an invisible 'fat' line per character for handling mouse over events
    character_ranks.append("path")
        .attr("class", "hover_line")
        .attr("d", function(d) { return line(d.values); })
        .on("mouseover", function(d) { 
            for (var i = 0; i < paired_lines.length; ++i) {
                
                // Hovered / Not Hovered
                if (paired_lines[i].hover == this) {

                    // Grab the visible line with color associated with "this" which is a fat, invisible line
                    var colored_line = d3.select(paired_lines[i].color);

                    // Move colored line to front so it renders on top
                    var node = colored_line.node();
                    node.parentNode.parentNode.appendChild(node.parentNode);
                    
                    // Increase hovered line width
                    colored_line.style("stroke-width", "3.5px");
                }
                else {
                    // Not hovered
                    d3.select(paired_lines[i].color).style("stroke", "#d3d3d3");
            } 
            } 
        })
        .on("mouseout", function(d) { 
            for (var i = 0; i < paired_lines.length; ++i) {

                var color_line = d3.select(paired_lines[i].color);
                
                // Revert to default width
                color_line.style("stroke-width", "1.5px"); // Would like to grab this data from css

                // Revert color change
                color_line.style("stroke", all_rankings[i].color);
            }
        });

    // Add text label for each character
    var offset = 0;
    character_ranks.append("text")
            .datum(function(d) { return {name: d.character, value: d.values[0]}; })
            .attr("transform", function(d) {
                // Calculate index along y-axis to display name.
                // Default to align with line position for x=0
                // But move to end of list if line doesn't start until x > 0
                var y_index = ((d.value.date == 0 )? d.value.ranking : (all_rankings.length + offset--));
                return "translate(" + x(0) + "," + y(y_index) + ")"; 
            })
            .attr("x", -10)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function(d) { return d.name; })
            .on("mouseover", function(d) {
                var char_name = d3.select(this)[0][0].textContent;
                console.log(char_name);
            });


    // Pair up the colored line and hover line in an object per character 
    /*
        Paired lines = [
            {
                color = SVGPathElement,
                hover = SVGPathElement
            },
            {
                color = SVGPathElement,
                hover = SVGPathElement
            },
            ...  
        ]
    */
    var paired_lines = svg.selectAll(".rank_line")[0].map( function(entry) { return { color: entry } } );
    var hover_lines = svg.selectAll(".hover_line")[0];
    for (var i = 0; i < hover_lines.length; ++i)
        paired_lines[i].hover = hover_lines[i];
}
