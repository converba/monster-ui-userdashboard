define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'voicemails',
		i18n: [ 'en-US', 'de-DE', 'ru-RU' ],
		css: [ 'voicemails' ]
	};

	const vars = {
		maxRange: 31,
		defaultRange: 1
	};

	var app = {
		requests: {},

		subscribe: {
			'userdashboard.initModules': 'voicemailsInitModuleLayout'
		},

		voicemailsInitModuleLayout: function(args) {
			var self = this;

			self.extendI18nOfSubmodule(CONFIG, function () {
				var menuTitle = self.i18n.active().userdashboard.submodules[CONFIG.submoduleName].menuTitle;
				self.layout.menus.push({
					tabs: [
						{
							text: menuTitle,
							callback: self.voicemailsRender
						}
					]
				});
				args.callback && args.callback(CONFIG);
			});
		},

		voicemailsRender: function(pArgs){
			var self = this,
				args = pArgs || {},
				parent = args.container || $('#voicemails_app_container .app-content-wrapper');

			self.voicemailsListVMBoxes(function(vmboxes) {
				var dataTemplate = {
						vmboxes: vmboxes,
						count: vmboxes.length
					},
					template = $(self.getTemplate({
						name: 'received-voicemails',
						submodule: CONFIG.submoduleName,
						data: dataTemplate
					}));

				self.voicemailsInitDatePicker(parent, template);

				self.voicemailsBindReceivedVMs(template);

				parent.fadeOut(function() {
					$(this)
						.empty()
						.append(template)
						.fadeIn();
				});
			});
		},

		voicemailsInitDatePicker: function(parent, template) {
			var self = this,
				dates = monster.util.getDefaultRangeDates(vars.defaultRange),
				fromDate = dates.from,
				toDate = dates.to;

			var optionsDatePicker = {
				container: template,
				range: vars.maxRange
			};

			monster.ui.initRangeDatepicker(optionsDatePicker);

			template.find('#startDate').datepicker('setDate', fromDate);
			template.find('#endDate').datepicker('setDate', toDate);

			template.find('.apply-filter').on('click', function(e) {
				var vmboxId = template.find('#select_vmbox').val();

				self.voicemailsDisplayVMList(parent, vmboxId);
			});

			template.find('.toggle-filter').on('click', function() {
				template.find('.filter-by-date').toggleClass('active');
			});
		},

		voicemailsBindReceivedVMs: function(template) {
			var self = this,
				$selectVMBox = template.find('.select-vmbox'),
				voicemailsI18n = self.i18n.active().userdashboard.submodules.voicemails;

			monster.ui.tooltips(template);
			monster.ui.footable(template.find('.footable'));

			monster.ui.chosen($selectVMBox, {
				placeholder_text_single: voicemailsI18n.receivedVMs.actionBar.selectVM.none
			});

			$selectVMBox.on('change', function() {
				var vmboxId = $(this).val();

				// We update the select-vmbox from the listing vm messages when we click on a vmbox in the welcome page
				template.find('.select-vmbox').val(vmboxId).trigger('chosen:updated');

				self.voicemailsDisplayVMList(template, vmboxId);
			});

			template.find('#refresh_voicemails').on('click', function() {
				var vmboxId = $selectVMBox.val();

				if (vmboxId !== 'none') {
					self.voicemailsDisplayVMList(template, vmboxId);
				}
			});

			template.find('.mark-as-link').on('click', function() {
				var folder = $(this).data('type'),
					vmboxId = $selectVMBox.val(),
					$messages = template.find('.select-message:checked'),
					messages = [];

				$messages.each(function() {
					messages.push($(this).data('media-id'));
				});

				template.find('.data-state')
					.hide();

				template.find('.loading-state')
					.show();

				self.voicemailsUpdateFolder(vmboxId, messages, folder, function() {
					self.voicemailsDisplayVMList(template, vmboxId);
				});
			});

			template.find('.delete-voicemails').on('click', function() {
				var vmboxId = $selectVMBox.val(),
					$messages = template.find('.select-message:checked'),
					messages = [];

				$messages.each(function() {
					messages.push($(this).data('media-id'));
				});

				template.find('.data-state')
					.hide();

				template.find('.loading-state')
					.show();

				self.voicemailsBulkRemoveMessages(vmboxId, messages, function() {
					self.voicemailsDisplayVMList(template, vmboxId);
				});
			});

			template.find('#select_move_to_vmbox').on('change', function() {
				var targetId = $(this).val(),
					vmboxId = $selectVMBox.val(),
					$messages = template.find('.select-message:checked'),
					messages = [];

				$messages.each(function() {
					messages.push($(this).data('media-id'));
				});

				template.find('.data-state')
					.hide();

				template.find('.loading-state')
					.show();

				self.voicemailsMoveVoicemailMessages(vmboxId, targetId, messages, function() {
					self.voicemailsDisplayVMList(template, vmboxId);
				});
			});

			template.find('.move-to-vmbox').on('click', function() {
				var targetId = $(this).data('id'),
					vmboxId = $selectVMBox.val(),
					$messages = template.find('.select-message:checked'),
					messages = [];

				$messages.each(function() {
					messages.push($(this).data('media-id'));
				});

				template.find('.data-state')
					.hide();

				template.find('.loading-state')
					.show();

				self.voicemailsMoveVoicemailMessages(vmboxId, targetId, messages, function() {
					self.voicemailsDisplayVMList(template, vmboxId);
				});
			});

			template.on('click', '.play-vm', function(e) {
				var $row = $(this).parents('.voicemail-row'),
					$activeRows = template.find('.voicemail-row.active');

				if (!$row.hasClass('active') && $activeRows.length !== 0) {
					return;
				}

				e.stopPropagation();

				var vmboxId = template.find('#select_vmbox').val(),
					mediaId = $row.data('media-id');

				template.find('table').addClass('highlighted');
				$row.addClass('active');

				self.voicemailsPlay(template, vmboxId, mediaId);
			});

			template.on('click', '.details-vm', function() {
				var $row = $(this).parents('.voicemail-row'),
					callId = $row.data('call-id');

				self.voicemailsGetCDR(callId, function(cdr) {
					var template = $(self.getTemplate({
						name: 'voicemails-CDRDialog',
						submodule: CONFIG.submoduleName
					}));

					monster.ui.renderJSON(cdr, template.find('#jsoneditor'));

					monster.ui.dialog(template, { title: voicemailsI18n.receivedVMs.CDRPopup.title });
				}, function() {
					monster.ui.alert(voicemailsI18n.receivedVMs.noCDR);
				});
			});

			var afterSelect = function() {
				if (template.find('.select-message:checked').length) {
					template.find('.hidable').removeClass('hidden');
					template.find('.main-select-message').prop('checked', true);
				} else {
					template.find('.hidable').addClass('hidden');
					template.find('.main-select-message').prop('checked', false);
				}
			};

			template.on('change', '.select-message', function() {
				afterSelect();
			});

			template.find('.main-select-message').on('click', function() {
				var $this = $(this),
					isChecked = $this.prop('checked');

				template.find('.select-message').prop('checked', isChecked);

				afterSelect();
			});

			template.find('.select-some-messages').on('click', function() {
				var $this = $(this),
					type = $this.data('type');

				template.find('.select-message').prop('checked', false);

				if (type !== 'none') {
					if (type === 'all') {
						template.find('.select-message').prop('checked', true);
					} else if (['new', 'saved', 'deleted'].indexOf(type) >= 0) {
						template.find('.voicemail-row[data-folder="' + type + '"] .select-message').prop('checked', true);
					}
				}

				afterSelect();
			});

			template.on('click', '.select-line', function() {
				if (template.find('table').hasClass('highlighted')) {
					return;
				}

				var cb = $(this).parents('.voicemail-row').find('.select-message');

				cb.prop('checked', !cb.prop('checked'));
				afterSelect();
			});
		},

		voicemailsPlay: function(template, vmboxId, mediaId) {
			var self = this,
				$row = template.find('.voicemail-row[data-media-id="' + mediaId + '"]');

			template.find('table').addClass('highlighted');
			$row.addClass('active');

			$row.find('.duration, .actions').hide();

			var uri = self.voicemailsFormatVMURI(vmboxId, mediaId),
				dataTemplate = {
					uri: uri
				},
				templateCell = $(self.getTemplate({
					name: 'cell-voicemail-player',
					submodule: CONFIG.submoduleName,
					data: dataTemplate
				}));

			// If folder is new, we want to change it to saved
			if ($row.data('folder') === 'new') {
				self.updateFolder(vmboxId, [ mediaId ], 'saved', function() {
					$row.data('folder', 'saved')
						.attr('data-folder', 'saved');

					$row.find('.status').data('folder', 'saved')
						.attr('data-folder', 'saved')
						.html(self.i18n.active().userdashboard.submodules.voicemails.receivedVMs.status.saved);
				});
			}

			$row.append(templateCell);

			var closePlayerOnClickOutside = function(e) {
					if ($(e.target).closest('.voicemail-player').length) {
						return;
					}
					e.stopPropagation();
					closePlayer();
				},
				closePlayer = function() {
					$(document).off('click', closePlayerOnClickOutside);
					self.voicemailsRemoveOpacityLayer(template, $row);
				};

			$(document).on('click', closePlayerOnClickOutside);

			templateCell.find('.close-player').on('click', closePlayer);

			// Autoplay in JS. For some reason in HTML, we can't pause the stream properly for the first play.
			templateCell.find('audio').get(0).play();
		},

		voicemailsFormatVMURI: function(vmboxId, mediaId) {
			var self = this;

			return self.apiUrl + 'accounts/' + self.accountId + '/vmboxes/' + vmboxId + '/messages/' + mediaId + '/raw?auth_token=' + self.getAuthToken();
		},

		voicemailsRemoveOpacityLayer: function(template, $activeRows) {
			$activeRows.find('.voicemail-player').remove();
			$activeRows.find('.duration, .actions').show();
			$activeRows.removeClass('active');
			template.find('table').removeClass('highlighted');
		},

		voicemailsDisplayVMList: function(container, vmboxId) {
			var self = this,
				fromDate = container.find('input.filter-from').datepicker('getDate'),
				toDate = container.find('input.filter-to').datepicker('getDate'),
				filterByDate = container.find('.filter-by-date').hasClass('active');

			container.removeClass('empty');
			//container.find('.counts-wrapper').hide();
			container.find('.count-wrapper[data-type="new"] .count-text').html('?');
			container.find('.count-wrapper[data-type="total"] .count-text').html('?');

			// Gives a better feedback to the user if we empty it as we click... showing the user something is happening.
			container.find('.data-state')
				.hide();

			container.find('.loading-state')
				.show();

			container.find('.hidable').addClass('hidden');
			container.find('.main-select-message').prop('checked', false);

			monster.ui.footable(container.find('.voicemails-table .footable'), {
				getData: function(filters, callback) {
					if (filterByDate) {
						filters = $.extend(true, filters, {
							created_from: monster.util.dateToBeginningOfGregorianDay(fromDate),
							created_to: monster.util.dateToEndOfGregorianDay(toDate)
						});
					}
					// we do this to keep context
					self.voicemailsGetRows(filters, vmboxId, function($rows, data, formattedData) {
						container.find('.count-wrapper[data-type="new"] .count-text').html(formattedData.counts.newMessages);
						container.find('.count-wrapper[data-type="total"] .count-text').html(formattedData.counts.totalMessages);

						callback && callback($rows, data);
					});
				},
				afterInitialized: function() {
					container.find('.data-state')
						.show();

					container.find('.loading-state')
						.hide();
				},
				backendPagination: {
					enabled: false
				}
			});
		},

		voicemailsGetRows: function(filters, vmboxId, callback) {
			var self = this;

			self.voicemailsNewGetVMBoxMessages(filters, vmboxId, function(data) {
				var formattedData = self.voicemailsFormatMessagesData(data.data, vmboxId),
					dataTemplate = {
						voicemails: formattedData.voicemails
					},
					$rows = $(self.getTemplate({
						name: 'voicemails-rows',
						submodule: CONFIG.submoduleName,
						data: dataTemplate
					}));

				callback && callback($rows, data, formattedData);
			});
		},

		voicemailsFormatMessagesData: function(voicemails, vmboxId) {
			var self = this,
				formattedData = {
					voicemails: [],
					counts: {
						newMessages: 0,
						totalMessages: 0
					}
				};

			_.each(voicemails, function(vm) {
				vm.formatted = {};
				vm.formatted.to = monster.util.formatPhoneNumber(vm.to.substr(0, vm.to.indexOf('@')));
				vm.formatted.from = monster.util.formatPhoneNumber(vm.from.substr(0, vm.from.indexOf('@')));
				vm.formatted.callerIDName = monster.util.formatPhoneNumber(vm.caller_id_name);
				vm.formatted.duration = monster.util.friendlyTimer(vm.length / 1000);
				vm.formatted.uri = self.voicemailsFormatVMURI(vmboxId, vm.media_id);
				vm.formatted.callId = monster.util.getModbID(vm.call_id, vm.timestamp);
				vm.formatted.mediaId = vm.media_id;
				vm.formatted.showCallerIDName = vm.formatted.callerIDName !== vm.formatted.from;

				formattedData.voicemails.push(vm);

				if (vm.folder === 'new') {
					formattedData.counts.newMessages++;
				}
			});

			formattedData.counts.totalMessages = formattedData.voicemails.length;

			return formattedData;
		},

		voicemailsNewGetVMBoxMessages: function(filters, vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.listMessages',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId,
					filters: filters
				},
				success: function(data) {
					callback && callback(data);
				}
			});
		},

		voicemailsBulkUpdateMessages: function(vmboxId, data, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.updateMessages',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		voicemailsBulkRemoveMessages: function(vmboxId, messages, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.deleteMessages',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId,
					data: {
						messages: messages
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		voicemailsUpdateFolder: function(vmboxId, messages, folder, callback) {
			var self = this;

			self.voicemailsUpdateVMBoxMessages(vmboxId, messages, folder, function() {
				callback && callback();
			});
		},

		voicemailsGetCDR: function(callId, callback, error) {
			var self = this;

			self.callApi({
				resource: 'cdrs.get',
				data: {
					accountId: self.accountId,
					cdrId: callId,
					generateError: false
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(data, status, globalHandler) {
					if (data && data.error === '404') {
						error && error({});
					} else {
						globalHandler(data, { generateError: true });
					}
				}
			});
		},

		voicemailsMoveVoicemailMessages: function(vmboxId, targetId, messages, callback) {
			var self = this,
				data = {
					messages: messages,
					source_id: targetId
				};

			self.voicemailsBulkUpdateMessages(vmboxId, data, callback);
		},

		voicemailsUpdateVMBoxMessages: function(vmboxId, messages, folder, callback) {
			var self = this,
				data = {
					messages: messages,
					folder: folder
				};

			self.voicemailsBulkUpdateMessages(vmboxId, data, callback);
		},

		voicemailsListVMBoxes: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false,
						filter_owner_id: self.userId
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}

	};

	return app;
});
