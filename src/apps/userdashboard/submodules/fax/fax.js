define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'fax',
		i18n: [ 'en-US' ],
		css: [ 'fax' ]
	};

	var app = {
		requests: {},

		subscribe: {
			'userdashboard.initModules': 'faxInitModuleLayout'
		},

		faxInitModuleLayout: function(args) {
			var self = this;

			self.extendI18nOfSubmodule(CONFIG, function () {
				var i18n = self.i18n.active().userdashboard.submodules[CONFIG.submoduleName];

				self.layout.menus.push({
					tabs: [
						{
							text: i18n.menuTitle,
							menus: [{
								tabs: [{
									text: i18n.inbound.menuTitle,
									callback: self.faxInboundRender
								},{
									text: i18n.outbound.menuTitle,
									callback: self.faxOutboundRender
								},{
									text: i18n.emailToFax.menuTitle,
									callback: self.faxEmailToFaxRender
								}]
							}]
						}
					]
				});

				args.callback && args.callback(CONFIG);
			});
		},
		faxInboundRender: function(args){
			var self = this,
				$container = args.container,
				template = self.getTemplate({
					name: 'inbound',
					submodule: CONFIG.submoduleName
				});

			$container
				.empty()
				.append(template)
				.show();
		},
		faxOutboundRender: function(args){
			var self = this,
				$container = args.container,
				template = self.getTemplate({
					name: 'outbound',
					submodule: CONFIG.submoduleName
				});

			$container
				.empty()
				.append(template)
				.show();
		},
		faxEmailToFaxRender: function(args){
			var self = this,
				$container = args.container,
				template = self.getTemplate({
					name: 'emailToFax',
					submodule: CONFIG.submoduleName
				});

			$container
				.empty()
				.append(template)
				.show();
		}
	};

	return app;
});
