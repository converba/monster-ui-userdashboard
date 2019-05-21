define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'user',
		i18n: [ 'en-US' ],
		css: [ 'user' ]
	};

	var deviceIcons = {
		'cellphone': 'fa fa-phone',
		'smartphone': 'icon-telicon-mobile-phone',
		'landline': 'icon-telicon-home',
		'mobile': 'icon-telicon-sprint-phone',
		'softphone': 'icon-telicon-soft-phone',
		'sip_device': 'icon-telicon-voip-phone',
		'sip_uri': 'icon-telicon-voip-phone',
		'fax': 'icon-telicon-fax',
		'ata': 'icon-telicon-ata'
	};

	var app = {
		requests: {},

		subscribe: {
			'userdashboard.initModules': 'userFeaturesInitModuleLayout'
		},

		userFeaturesInitModuleLayout: function(args) {
			var self = this;

			self.extendI18nOfSubmodule(CONFIG, function () {
				var i18n = self.i18n.active().userdashboard.submodules[CONFIG.submoduleName];
				self.layout.menus.push({
					tabs: [
						{
							text: i18n.menuTitle,
							menus: [{
								tabs: [{
									text: i18n.mainFeatures.menuTitle,
									callback: self.userFeaturesMainRender
								},{
									text: i18n.outOfOffice.menuTitle,
									callback: self.userFeaturesOutOfOfficeRender
								},{
									text: i18n.findMeFollowMe.title,
									callback: self.userFeaturesFindMeFollowMeRender
								}]
							}]
						}
					]
				});
				args.callback && args.callback(CONFIG);
			});
		},
		userFeaturesMainRender: function(args){
			var self = this,
				$container = args.container,
				template = self.getTemplate({
					name: 'userFeaturesMain',
					submodule: CONFIG.submoduleName
				});

			$container
				.empty()
				.append(template)
				.show();
		},

		userFeaturesFindMeFollowMeRender: function(args) {
			var self = this,
				$container = args.container,
				//template = $(monster.template(self, 'userFeaturesFindMeFollowMe', {})),
				i18n = self.i18n.active().userdashboard.submodules.user;

			monster.parallel({
				userDevices: function(callback) {
					self.userFeaturesListDeviceUser(self.userId, function(devices) {
						callback(null, devices);
					});
				},
				userCallflow: function(callback) {
					self.userFeaturesGetMainCallflow(self.userId, function(callflow) {
						callback(null, callflow);
					});
				},
				user: function(callback) {
					self.callApi({
						resource: 'user.get',
						data: {
							accountId: self.accountId,
							userId: self.userId
						},
						success: function (user) {
							callback(null, user);
						}
					});
				}
			}, function(error, results) {
				if (!results.userCallflow) {
					monster.ui.alert('error', i18n.findMeFollowMe.noNumber);
				} else if (!results.userDevices || results.userDevices.length === 0) {
					monster.ui.alert('error', i18n.findMeFollowMe.noDevice);
				} else {
					var currentUser = results.user.data,
						userCallflow = results.userCallflow,
						featureTemplate = $(self.getTemplate({
							name: 'userFeaturesFindMeFollowMe',
							submodule: CONFIG.submoduleName,
							data: { user: results.user }
						}));

						switchFeature = featureTemplate.find('.switch-state');
						featureForm = featureTemplate.find('#find-me-follow-me-form');
						args = {
							callback: function() {
								popup.dialog('close').remove();
							},
							openedTab: 'features'
						};
						userDevices = {};

					var nodeSearch = userCallflow.flow,
						endpoints;

					while (nodeSearch.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(nodeSearch.module) < 0) {
						nodeSearch = nodeSearch.children._;
					}
					endpoints = nodeSearch.module === 'ring_group' ? nodeSearch.data.endpoints : [];

					$.each(results.userDevices, function(i, val) {
						userDevices[val.id] = val;
					});

					endpoints = $.map(endpoints, function(endpoint) {
						if (userDevices[endpoint.id]) {
							var device = userDevices[endpoint.id];
							delete userDevices[endpoint.id];
							return {
								id: endpoint.id,
								delay: endpoint.delay,
								timeout: endpoint.timeout,
								name: device.name,
								icon: deviceIcons[device.device_type],
								disabled: false
							};
						}
					});

					$.each(userDevices, function(i, device) {
						endpoints.push({
							id: device.id,
							delay: 0,
							timeout: 0,
							name: device.name,
							icon: deviceIcons[device.device_type],
							disabled: true
						});
					});

					monster.pub('common.ringingDurationControl.render', {
						container: featureForm,
						endpoints: endpoints,
						hasDisableColumn: true
					});

					featureTemplate.find('.cancel-link').on('click', function() {
						popup.dialog('close').remove();
					});

					switchFeature.on('change', function() {
						$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
					});

					featureTemplate.find('.save').on('click', function() {
						var enabled = switchFeature.prop('checked');

						monster.pub('common.ringingDurationControl.getEndpoints', {
							container: featureForm,
							callback: function(endpoints) {
								currentUser.smartpbx = currentUser.smartpbx || {};
								currentUser.smartpbx.find_me_follow_me = currentUser.smartpbx.find_me_follow_me || {};
								currentUser.smartpbx.find_me_follow_me.enabled = (enabled && endpoints.length > 0);

								var callflowNode = {};

								if (enabled && endpoints.length > 0) {
									callflowNode.module = 'ring_group';
									callflowNode.data = {
										strategy: 'simultaneous',
										timeout: 20,
										endpoints: []
									};

									$.each(endpoints, function(i, endpoint) {
										callflowNode.data.endpoints.push({
											id: endpoint.id,
											endpoint_type: 'device',
											delay: endpoint.delay,
											timeout: endpoint.timeout
										});

										if ((endpoint.delay + endpoint.timeout) > callflowNode.data.timeout) {
											callflowNode.data.timeout = (endpoint.delay + endpoint.timeout);
										}
									});
								} else {
									callflowNode.module = 'user';
									callflowNode.data = {
										can_call_self: false,
										id: self.userId,
										timeout: 20
									};
								}

								// In next 5 lines, look for user/group node, and replace it with the new data;
								var flow = userCallflow.flow;
								while (flow.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(flow.module) < 0) {
									flow = flow.children._;
								}
								flow.module = callflowNode.module;
								flow.data = callflowNode.data;

								monster.parallel({
									callflow: function(callbackParallel) {
										self.callApi({
											resource: 'callflow.update',
											data: {
												accountId: self.accountId,
												callflowId: userCallflow.id,
												data: userCallflow
											},
											success: function(callflowData) {
												callbackParallel && callbackParallel(null, callflowData.data);
											}
										});
									},
									user: function(callbackParallel) {
										self.userFeaturesUpdateUser(currentUser, function(data) {
											callbackParallel && callbackParallel(null, data.data);
										});
									}
								}, function(err, results) {
									args.userId = results.user.id;
									// TODO: Will show message to user?
								});
							}
						});
					});

					$container
						.empty()
						.append(featureTemplate)
						.show();
				}
			});



		},


		userFeaturesUpdateUser: function(userData, callback) {
			var self = this;

			userData = self.userFeaturesCleanUserData(userData);

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: self.userId,
					data: userData
				},
				success: function(userData) {
					callback && callback(userData);
				}
			});
		},

		userFeaturesCleanUserData: function(userData) {
			userData = $.extend(true, {}, userData);
			var fullName = userData.first_name + ' ' + userData.last_name,
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

			if (userData.timezone === 'inherit') {
				delete userData.timezone;
			}

			delete userData.include_directory;
			delete userData.features;
			delete userData.extra;
			delete userData[''];

			return userData;
		},


		userFeaturesOutOfOfficeRender: function(args){
			var self = this,
				$container = args.container,
				template = self.getTemplate({
					name: 'userFeaturesOutOfOffice',
					submodule: CONFIG.submoduleName
				});

			$container
				.empty()
				.append(template)
				.show();
		},

		userFeaturesListDeviceUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
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

		userFeaturesGetMainCallflow: function(userId, callback){
			var self = this;

			self.userFeaturesListCallflowsUser(userId, function(listCallflows) {
				var indexMain = -1;

				$.each(listCallflows, function(index, callflow) {
					if (callflow.owner_id === userId && callflow.type === 'mainUserCallflow' || !('type' in callflow)) {
						indexMain = index;
						return false;
					}
				});

				if (indexMain === -1) {
					//toastr.error(self.i18n.active().users.noUserCallflow);
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
		userFeaturesListCallflowsUser: function(userId, callback) {
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
		}
	};

	return app;
});
