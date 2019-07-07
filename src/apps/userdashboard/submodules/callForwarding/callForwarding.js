define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'callForwarding',
		i18n: [ 'en-US', 'ru-RU' ],
		css: [ 'callForwarding' ]
	};

	var app = {
		requests: {},

		subscribe: {
			'userdashboard.initModules': 'callForwardingInitModuleLayout'
		},

		callForwardingInitModuleLayout: function(args) {
			var self = this;

			self.extendI18nOfSubmodule(CONFIG, function () {
				var menuTitle = self.i18n.active().userdashboard.submodules[CONFIG.submoduleName].menuTitle;
				self.layout.menus.push({
					tabs: [
						{
							text: menuTitle,
							callback: self.callForwardingRender
						}
					]
				});
				args.callback && args.callback(CONFIG);
			});
		},

		callForwardingRender: function(args){
			var self = this;
			self.callForwardingGetUser(self.userId, function(currentUser) {
				currentUser.extra = currentUser.extra || {};
				var featureUser = $.extend(true, {}, currentUser);
				self.callForwardingGetMainCallflow(featureUser.id, function(mainCallflow) {
					if (mainCallflow && 'flow' in mainCallflow) {
						var flow = mainCallflow.flow;
						while (flow.module !== 'user' && '_' in flow.children) {
							flow = flow.children._;
						}
						if (flow.data.timeout < 30) {
							featureUser.extra.timeoutTooShort = true;
						}
					}
					self.callForwardingRenderCallForward(featureUser, args.container);
				});
			});
		},

		callForwardingRenderCallForward: function(currentUser, $container) {
			var self = this,
				formattedCallForwardData = self.callForwardingFormatCallForwardData(currentUser),
				featureTemplate = $(self.getTemplate({
					name: 'callForwarding',
					data: formattedCallForwardData,
					submodule: CONFIG.submoduleName
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#call_forward_form'),
				args = {
					callback: function() {
						// popup.dialog('close').remove();
					},
					openedTab: 'features'
				},
				timeoutWarningBox = featureTemplate.find('.help-box.red-box');

			monster.ui.mask(featureTemplate.find('#number'), 'phoneNumber');

			if (currentUser.hasOwnProperty('call_forward') && currentUser.call_forward.require_keypress) {
				timeoutWarningBox.hide();
			}

			monster.ui.validate(featureForm);

			featureTemplate.find('input[name="require_keypress"]').on('change', function() {
				timeoutWarningBox.toggle();
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('.feature-select-mode button').on('click', function() {
				var $this = $(this);

				featureTemplate.find('.feature-select-mode button').removeClass('selected monster-button-primary');
				$(this).addClass('selected monster-button-primary');

				$this.data('value') === 'off' ? featureTemplate.find('.content').slideUp() : featureTemplate.find('.content').slideDown();
				$this.data('value') === 'failover' ? featureTemplate.find('.failover-info').slideDown() : featureTemplate.find('.failover-info').slideUp();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var formData = monster.ui.getFormData('call_forward_form'),
					phoneNumber = monster.util.getFormatPhoneNumber(formData.number).e164Number,
					isValidPhoneNumber = !_.isUndefined(phoneNumber);

				if (monster.ui.valid(featureForm) && isValidPhoneNumber) {
					formData.require_keypress = !formData.require_keypress;

					var selectedType = featureTemplate.find('.feature-select-mode button.selected').data('value');
					if (selectedType === 'off') {
						formData.enabled = false;
						formData.failover = false;
					} else if (selectedType === 'failover') {
						formData.enabled = false;
						formData.failover = true;
					} else {
						formData.enabled = true;
						formData.failover = false;
					}

					formData.number = phoneNumber;
					delete formData.phoneType;

					var userToSave = $.extend(true, {}, currentUser, { call_forward: formData });

					if (timeoutWarningBox.is(':visible')) {
						args.openedTab = 'name';
					}


					self.callForwardingUpdateUser(userToSave, function(data) {
						args.userId = data.data.id;

						// self.usersRender(args);
					});
				}
			});

			if (currentUser.hasOwnProperty('call_forward') && currentUser.call_forward.number && /^(\+1)/.test(currentUser.call_forward.number)) {
				featureTemplate.find('#phoneType').val('mobile');
			} else {
				featureTemplate.find('#phoneType').val('deskphone');
			}

			$container
				.empty()
				.append(featureTemplate)
				.show();

			featureTemplate.find('.monster-button').blur();
		},

		callForwardingFormatCallForwardData: function(user) {
			var self = this,
				cfMode = 'off';

			user.extra = user.extra || {};

			//cfmode is on if call_forward.enabled = true
			//cfmode is failover if call_forward.enabled = false & call_forward.failover = true
			//cfmode is off if call_forward.enabled = false & call_forward.failover = false
			if (user.hasOwnProperty('call_forward') && user.call_forward.hasOwnProperty('enabled')) {
				if (user.call_forward.enabled === true) {
					cfMode = 'on';
				} else if (user.call_forward.enabled === false) {
					cfMode = user.call_forward.hasOwnProperty('failover') && user.call_forward.failover === true ? 'failover' : 'off';
				}

				if (_.has(user.call_forward, 'number')) {
					user.call_forward.number = monster.util.unformatPhoneNumber(user.call_forward.number);
				}
			}

			user.extra.callForwardMode = cfMode;

			return user;
		},

		callForwardingGetUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(user) {
					callback && callback(user.data);
				}
			});
		},

		callForwardingGetMainCallflow: function(userId, callback) {
			var self = this;

			self.callForwardingListCallflowsUser(userId, function(listCallflows) {
				var indexMain = -1;

				_.each(listCallflows, function(callflow, index) {
					if (callflow.type === 'mainUserCallflow' || !('type' in callflow)) {
						indexMain = index;
						return false;
					}
				});

				if (indexMain === -1) {
					// monster.ui.toast({
					// 	type: 'error',
					// 	message: self.i18n.active().users.noUserCallflow
					// });
					callback(null);
				} else {
					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: listCallflows[indexMain].id
						},
						success: function(data) {
							callback(data.data);
						},
						error: function() {
							callback(listCallflows[indexMain]);
						}
					});
				}
			});
		},

		callForwardingListCallflowsUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		callForwardingUpdateUser: function(userData, callback) {
			var self = this;

			userData = self.callForwardingCleanUserData(userData);

			self.callForwardingUpdateUserAPI(userData, callback, self.accountId);
		},

		callForwardingCleanUserData: function(userData) {
			var self = this,
				userData = $.extend(true, {}, userData),
				fullName = monster.util.getUserFullName(userData),
				defaultCallerIdName = fullName.substring(0, 15),
				newCallerIDs = {
					caller_id: {
						internal: {
							name: defaultCallerIdName
						}
					}
				};

			userData = $.extend(true, userData, newCallerIDs);
			/* If the user has been removed from the directory */
			if (userData.extra) {
				if (userData.extra.includeInDirectory === false) {
					if ('directories' in userData && userData.extra.mainDirectoryId && userData.extra.mainDirectoryId in userData.directories) {
						delete userData.directories[userData.extra.mainDirectoryId];
					}
				} else {
					userData.directories = userData.directories || {};

					if (userData.extra.mainCallflowId) {
						userData.directories[userData.extra.mainDirectoryId] = userData.extra.mainCallflowId;
					}
				}

				if ('differentEmail' in userData.extra && userData.extra.differentEmail) {
					if ('email' in userData.extra) {
						userData.email = userData.extra.email;
					}
				} else {
					userData.email = userData.username;
				}

				if ('language' in userData.extra) {
					if (userData.extra.language !== 'auto') {
						userData.language = userData.extra.language;
					} else {
						delete userData.language;
					}
				}

				/**
				 * When updating the user type, override existing one with new
				 * user type selected.
				 * Once set the `service` prop should not be removed by the UI.
				 *
				 */
				if (userData.extra.hasOwnProperty('licensedRole')) {
					userData.service = {
						plans: {}
					};
					userData.service.plans[userData.extra.licensedRole] = {
						account_id: monster.config.resellerId,
						overrides: {}
					};
				}
			}

			if (userData.hasOwnProperty('call_forward')) {
				if (userData.call_forward.number === '') {
					delete userData.call_forward.number;
				}
			}

			// if presence_id doesn't have a proper value, delete it and remove the internal callerId
			if (!userData.hasOwnProperty('presence_id') || userData.presence_id === 'unset' || !userData.presence_id) {
				delete userData.presence_id;

				if (userData.caller_id.hasOwnProperty('internal')) {
					delete userData.caller_id.internal.number;
				}
			} else {
				// Always set the Internal Caller-ID Number to the Main Extension/Presence ID
				userData.caller_id.internal.number = userData.presence_id + '';
			}

			if (userData.hasOwnProperty('caller_id_options') && userData.caller_id_options.hasOwnProperty('outbound_privacy') && userData.caller_id_options.outbound_privacy === 'default') {
				delete userData.caller_id_options.outbound_privacy;

				if (_.isEmpty(userData.caller_id_options)) {
					delete userData.caller_id_options;
				}
			}

			if (userData.timezone === 'inherit') {
				delete userData.timezone;
			}

			delete userData.include_directory;
			delete userData.features;
			delete userData.extra;
			delete userData[''];

			return userData;
		},

		callForwardingUpdateUserAPI: function(userData, callback, accountId) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: accountId,
					userId: userData.id,
					data: userData
				},
				success: function(userData) {
					callback && callback(userData);
				}
			});
		},
	};

	return app;
});
