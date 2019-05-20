define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'mobile',
		i18n: [ 'en-US' ],
		css: [ 'mobile' ]
	};

	var app = {
		requests: {},

		subscribe: {
			'userdashboard.initModules': 'mobileInitModuleLayout'
		},

		mobileInitModuleLayout: function(args) {
			var self = this;

			self.extendI18nOfSubmodule(CONFIG, function () {
				var menuTitle = self.i18n.active().userdashboard.submodules[CONFIG.submoduleName].menuTitle;
				self.layout.menus.push({
					tabs: [
						{
							text: menuTitle,
							callback: self.mobileRender
						}
					]
				});
				args.callback && args.callback(CONFIG);
			});
		},

		mobileRender: function(args){
			var self = this,
				container = args.container,
				template = template = self.getTemplate({
					name: 'mobile',
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
