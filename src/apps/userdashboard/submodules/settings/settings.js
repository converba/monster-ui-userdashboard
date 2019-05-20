define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'settings',
		i18n: [ 'en-US' ],
		css: [ 'settings' ]
	};

	var app = {
		requests: {},

		subscribe: {
			'userdashboard.initModules': 'settingsInitModuleLayout'
		},

		settingsInitModuleLayout: function(args) {
			var self = this;

			self.extendI18nOfSubmodule(CONFIG, function () {
				var menuTitle = self.i18n.active().userdashboard.submodules[CONFIG.submoduleName].menuTitle;
				self.layout.menus.push({
					tabs: [
						{
							text: menuTitle,
							callback: self.settingsRender
						}
					]
				});
				args.callback && args.callback(CONFIG);
			});
		},

		settingsRender: function(args){
			var self = this,
				container = args.container,
				template = self.getTemplate({
					name: 'settings',
					submodule: CONFIG.submoduleName
				});

			container
				.empty()
				.append(template)
				.show();
		}
	};

	return app;
});
