$(function(){

    // ------------------------- Query Model ---------------------------------

    window.Query = Backbone.Model.extend({

        initialize: function() {
            _.bindAll(this, 'keypress', 'render', 'showHelp', 'loadNext', 'go');
            this.template = _.template($('#query-template').html());
            this.lazyRender = _.debounce(this.render, 50);
            this.filter = '';
            $(document.body).keypress(this.keypress);
            document.onkeydown = this.keydown;
            this.bind('change', this.render);
            this.bind('change', this.loadNext);
        },

        render: function() {
            // Remove this section to enable "go button" prompt:
            if (this.get('summarylevel') && this.get(this.get("summarylevel")))
                // Don't re-render. We just selected the item we wanted so
                // we are going to force "go" there. (See `select`.)
                return;
            
            $("#search").html(this.template({query: this}));
            $('#filter-help').toggle(!!this.shouldShowFilterHelp());
            $('#filter-display').toggle(!!this.filter).text(this.filterDisplay());
            $('#help-link').click(this.showHelp);
            $("#summarylevel-select .link").click(_.bind(this.select, this, 'summarylevel'));
            $("#state-select .link").click(_.bind(this.select, this, 'state'));
            $('#county-select .link').click(_.bind(this.select, this, 'county'));
            $('#place-select .link').click(_.bind(this.select, this, 'place'));
            $('#tract-select .link').click(_.bind(this.select, this, 'tract'));
            $('.button.go').click(this.go);
            $('.button.csv').click(this.csv);
            $('.button.remove-column').click(this.remove_column);
            $('tr.row').click(this.twist_row);
            $('.button.show-family').click(this.show_family);
        },

        isCompletable: function() {
            return (this.get('summarylevel') && this.get('state'));
        },

        isComplete: function() {
            return !!(this.get('summarylevel') == 'nation' || this.get(this.get('summarylevel')));
        },

        shouldShowFilterHelp: function() {
            return this.isFilterable() && !this.filter;
        },

        isFilterable: function() {
            return !!this.get('summarylevel') && !this.isComplete();
        },

        filterDisplay: function() {
            return 'Results matching "' + this.filter + '"';
        },

        location: function() {
            if (!this.get('summarylevel')) return '';
            
            if (this.get('tract'))         return this.get('tract');
            if (this.get('place'))         return this.get('place');
            if (this.get('county'))        return this.get('county');
            if (this.get('state'))         return this.get('state');

            return '';
        },

        keydown: function(e) {
            if (e.which == 8) {
                e.preventDefault();
                var _this = window.query;
                _this.filter = _this.filter.substr(0, _this.filter.length - 1);
                _this.lazyRender();
            }
        },
        keypress: function(e) {
            if (e.which == 13) {
                if (this.filter) {
                    $('.link:first').trigger('click');
                } else if (this.isCompletable()) {
                    this.go();
                }
            } else if (e.charCode && this.isFilterable()) {
                this.filter += String.fromCharCode(e.charCode);
                this.lazyRender();
            }
        },

        filtered: function(list) {
            if (!this.filter) return list;
            var matcher = new RegExp(this.filter.replace(/[-[\]{}()+?.,\\^$|#\s]/ig, "\\$&").replace(/(\\\s)+/, '.*'), 'i');
            return _.filter(list, function(item){ return matcher.test(item[0]); });
        },

        select: function(level, e) {
            this.filter = "";
            var attrs = {};
            var el = $(e.currentTarget);
            var val = attrs[level] = el.attr('data-val');
            var display = attrs[level + 'Display'] = el.text();
            this.currentLevel = level;
            this.set(attrs);
            //this.controller.saveLocation('query/' + this.location());
            
            // Remove this section to enable "go button" prompt:
            var q = window.query;
            if (query.get('summarylevel') && query.get(query.get("summarylevel")))
                // The item we just selected is of the same type as our
                // target datatype. We just picked the value we wanted.
                this.go();
        },

        loadNext: function() {
            var level = this.currentLevel;
            if (level == 'state') {
                if (_.include(['tract', 'county'], this.get('summarylevel'))) {
                    this.loadCounties();
                } else if (this.get('summarylevel') == 'place') {
                    this.loadPlaces();
                }
            } else if (level == 'county' && this.get('summarylevel') == 'tract') {
                this.loadTracts();
            }
        },

        go: function() {
            if (window.location.pathname.indexOf('/data/') != -1 ) {
                //we're on the data page and are adding another
                window.location = window.location.href.replace('.html',',') + this.location() + '.html';
            } else {
                //we're on the homepage
                window.location = '/data/' + this.location() + '.html';
            }
        },
        
        csv: function() {
            var geoid_list = []
            $('.link').each(function() {
                geoid_list.push($(this).attr('data-val'))
            });
            window.location = '/data/' + geoid_list.join(',') + '.csv';
        },

        showHelp: function(e) {
            $(e.currentTarget).hide();
            $('#help').removeClass('hidden');
        },

        loadCounties: function() {
            $.getJSON('/internal/counties_for_state/' + this.get('state') + '.json', _.bind(function(response) {
                this.mappings.counties = response;
                this.render();
            }, this));
        },

        loadPlaces: function() {
            $.getJSON('/internal/places_for_state/' + this.get('state') + '.json', _.bind(function(response) {
                this.mappings.places = response;
                this.render();
            }, this));
        },

        loadTracts: function() {
            $.getJSON('/internal/tracts_for_county/' + this.get('county') + '.json', _.bind(function(response) {
                this.mappings.tracts = response;
                this.render();
            }, this));
        },
        
        remove_column: function() {
            geoid = $(this).attr('data-val');
            if (document.location.href.indexOf('/' + geoid) > 0) {
                document.location.href = document.location.href.replace(geoid + ',', '');
            } else {
                document.location.href = document.location.href.replace(',' + geoid, '');
            }
        },
        
        twist_row: function() {
            var show_child = !$($('tr[parent=' + $(this).attr('id') + ']')[0]).is(":visible");
            window.query.twist_row_helper($(this), show_child);
            $(this).toggleClass('closed')
            $(this).toggleClass('open');
        },
        
        twist_row_helper: function(parent_row, show_me) {
            $.each($('tr[parent=' + $(parent_row).attr('id') + ']'), function(index, value){
                if(show_me){
                    $(value).show();
                } else {
                    $(value).hide();
                }
                window.query.twist_row_helper(value, false);
            });
        },
        
        show_family: function() {
            geoid = $(this).attr('data-val');
            document.location.href = "/family/" + geoid + "/";
        },

        // ------------------------- Data ---------------------------------

        mappings: {

            summarylevels: ['tract', 'place', 'county', 'state', 'nation'],

            states: [
                ["Alabama"              ,"01"],
                ["Alaska"               ,"02"],
	            ["Arizona"              ,"04"],
	            ["Arkansas"             ,"05"],
	            ["California"           ,"06"],
	            ["Colorado"             ,"08"],
	            ["Connecticut"          ,"09"],
	            ["District of Columbia" ,"11"],
	            ["Delaware"             ,"10"],
	            ["Florida"              ,"12"],
	            ["Georgia"              ,"13"],
	            ["Hawaii"               ,"15"],
	            ["Iowa"                 ,"19"],
	            ["Idaho"                ,"16"],
	            ["Illinois"             ,"17"],
	            ["Indiana"              ,"18"],
	            ["Kansas"               ,"20"],
	            ["Kentucky"             ,"21"],
	            ["Louisiana"            ,"22"],
	            ["Massachusetts"        ,"25"],
	            ["Maryland"             ,"24"],
	            ["Maine"                ,"23"],
	            ["Michigan"             ,"26"],
	            ["Minnesota"            ,"27"],
	            ["Mississippi"          ,"26"],
	            ["Missouri"             ,"29"],
	            ["Montana"              ,"29"],
	            ["North Carolina"       ,"37"],
	            ["North Dakota"         ,"38"],
	            ["Nebraska"             ,"31"],
	            ["New Hampshire"        ,"33"],
	            ["New Jersey"           ,"34"],
	            ["New Mexico"           ,"35"],
	            ["Nevada"               ,"32"],
	            ["New York"             ,"36"],
	            ["Ohio"                 ,"39"],
	            ["Oklahoma"             ,"40"],
	            ["Oregon"               ,"41"],
	            ["Pennsylvania"         ,"42"],
	            ["Rhode Island"         ,"44"],
	            ["South Carolina"       ,"45"],
	            ["South Dakota"         ,"46"],
	            ["Tennessee"            ,"47"],
	            ["Texas"                ,"48"],
	            ["Utah"                 ,"49"],
	            ["Virginia"             ,"78"],
	            ["Vermont"              ,"50"],
	            ["Washington"           ,"53"],
	            ["Wisconsin"            ,"55"],
	            ["West Virginia"        ,"54"],
	            ["Wyoming"              ,"56"]
            ]
        }
    });

    var QueryController = Backbone.Controller.extend({

        routes: {
            "query/*query": "loadQuery"
        },

        loadQuery: function(query) {
            // No-op, for now.
        }

    });

    // ------------------------- Initialization -------------------------------

    window.query = new Query;
    query.render();

    query.controller = new QueryController;
    Backbone.history.start();

    // Table mouseover row highlighting.
    $(".report tr").hover(function() {
        $(this).addClass("highlight");
    }, function() {
        $(this).removeClass('highlight');
    });
    
});
