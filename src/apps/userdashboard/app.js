define(function(require){
	var $ = require('jquery'),
		monster = require('monster');
	var modulesConfig = require('./submodules');

	// Autoload submodules
	// (Submodules should be described in /apps/storagemgmt/modules.js)
	var modulesList = modulesConfig.submodules;
	var modulesPaths = [];
	for (var i = 0, len = modulesList.length; i < len; i++) {
		modulesPaths.push('./submodules/' + modulesList[i] + '/' + modulesList[i])
	}
	require(modulesPaths);

	var app = {
		name: 'userdashboard',
		css: ['app'],
		i18n: {
			'en-US': { customCss: false }
		},
		requests: {},
		subModules: modulesList,
		subscribe: {
			'userdashboard.initModules': 'define_dashboard_modules' // For all submodules
		},
		layout: {},

		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			/* Used to init the auth token and account id of self app */
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});

			self.initHandlebarsHelpers();
		},

		initHandlebarsHelpers: function() {
			Handlebars.registerHelper('compare', function (lvalue, operator, rvalue, options) {
				var operators, result;

				if (arguments.length < 3) {
					throw new Error('Handlerbars Helper \'compare\' needs 2 parameters');
				}

				if (options === undefined) {
					options = rvalue;
					rvalue = operator;
					operator = '===';
				}

				operators = {
					'==': function (l, r) { return l == r; },
					'===': function (l, r) { return l === r; },
					'!=': function (l, r) { return l != r; },
					'!==': function (l, r) { return l !== r; },
					'<': function (l, r) { return l < r; },
					'>': function (l, r) { return l > r; },
					'<=': function (l, r) { return l <= r; },
					'>=': function (l, r) { return l >= r; },
					'typeof': function (l, r) { return typeof l == r; }
				};

				if (!operators[operator]) {
					throw new Error('Handlerbars Helper \'compare\' doesn\'t know the operator ' + operator);
				}

				result = operators[operator](lvalue, rvalue);

				if (result) {
					return options.fn(this);
				} else {
					return options.inverse(this);
				}

			});
		},

		// Entry Point of the app
		render: function($container){

			var self = this,
				$parent = $container || $('#monster_content');
			var loadedModules = [];

			self.layout = {
				appType: 'fullscreen',
				menus: []
			};

			monster.pub('userdashboard.initModules', {
				callback: function (CONFIG) {
					self.addCSSofSubmodule(CONFIG);
					loadedModules.push(CONFIG.submoduleName);
					if (loadedModules.length >= self.subModules.length) {
						monster.ui.generateAppLayout(self, self.layout);
					}
				}
			});
		},

		extendI18nOfSubmodule: function (args, callback) {
			var self = this;
			if(args.i18n && args.submoduleName) {
				var submoduleLanguages = args.i18n;
				var curLanguage = self.i18n.hasOwnProperty(monster.config.whitelabel.language) ? monster.config.whitelabel.language : monster.defaultLanguage;

				if (submoduleLanguages.length && submoduleLanguages.length > 0) {
					if(submoduleLanguages.indexOf(curLanguage) > -1) {
						$.getJSON('/apps/' + self.name + '/submodules/' + args.submoduleName + '/i18n/' + curLanguage  + '.json')
							.done(function (newDict) {
								var dict = self.data.i18n[curLanguage];
								$.extend(true, dict, newDict);
								callback && callback();
							})
					}
				}
			} else {
				!!console && console.log && console.log('Extend i18n of submodule failed');
			}
		},

		addCSSofSubmodule: function (CONFIG) {
			var self = this;
			var cssFilesList = CONFIG.css || [];
			for (var i = 0, len = cssFilesList.length; i < len; i++) {
				var href = 'apps/' + self.name + '/submodules/' + CONFIG.submoduleName + '/' + cssFilesList[i] + '.css';
				$('head').append('<link rel="stylesheet" href="' + href + '" type="text/css" />');
			}
		},

		renderSettingsLayout: function(args) {
			var self = this,
				$container = args.container,
				template = $(monster.template(self, 'settings', {}));

			$container
				.empty()
				.append(template)
				.show();
		},

		getAll: function(callApiData, startKey, continueData) {
			// Warning! Method works for listed data only!
			// -- Usage:
			// self.getAll({
			//   resource: 'user.list',
			//   success: function(result){},
			//   error: function(data){},
			//   data: {
			//      someParam: someValue
			//   }
			// })

			continueData = continueData || { data:[] };
			var self = this;

			if(typeof(callApiData.resource) === 'undefined') {
				self.log('Error! Api keyword is undefined');
				return;
			}

			var requestData = $.extend({
				accountId: self.accountId,
				generateError: false
			}, callApiData.data || {});

			if(typeof(startKey) !== 'undefined') {
				requestData.startKey = startKey;
			}

			var newRequestData = {
				resource: callApiData.resource,
				data: requestData,
				success: function(response){
					response.data = $.merge(continueData.data, response.data);
					if(response.next_start_key && startKey !== response.next_start_key) {
						self.getAll(callApiData, response.next_start_key, response);
						return;
					}

					if(typeof(callApiData.success) === 'function') {
						callApiData.success(response);
					}
				},
				error: callApiData.error || function(){}
			};

			if(self.requests.hasOwnProperty(callApiData.resource)) {
				monster.request(newRequestData);
			} else {
				self.callApi(newRequestData);
			}
		}
	};

	return app;
});
