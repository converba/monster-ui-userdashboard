define(function(require){
	var $ = require('jquery'),
		toastr = require('toastr'),
		_ = require('lodash'),
		monster = require('monster');

	const CONFIG = {
		submoduleName: 'fax',
		i18n: [ 'en-US' ],
		css: [ 'fax' ]
	};

	const vars = {
		ranges: {
			default: 7,
			max: 31
		},
		faxboxes: {}
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

				self.faxGetFaxBoxes(function(faxboxes) {
					vars.faxboxes = _.keyBy(faxboxes, 'id');
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
										callback: self.faxRenderEmailToFaxLogs
									}]
								}]
							}
						]
					});

					args.callback && args.callback(CONFIG);
				})
			});
		},

		faxInboundRender: function(args){
			this.faxRenderCommon(args, 'inbound');
		},

		faxOutboundRender: function(args){
			this.faxRenderCommon(args, 'outbound');
		},

		faxRenderEmailToFaxLogs: function(pArgs) {
			var self = this,
				args = pArgs || {},
				parent = args.container || $('#userdashboard_app_container .app-content-wrapper');

			self.faxLogsGetData(function(logs) {
				var formattedData = self.faxLogsFormatDataTable(logs),
					template = $(self.getTemplate({
						name: 'emailToFaxLogs',
						submodule: CONFIG.submoduleName,
						data: {
							logs: formattedData
						}
					}));

				monster.ui.footable(template.find('.footable'));

				self.faxLogsBindEvents(template);

				parent
					.fadeOut(function() {
						$(this)
							.empty()
							.append(template)
							.fadeIn();
					});
			});
		},

		faxRenderCommon: function(args, type){
			var self = this,
				$container = args.container,
				template = $(self.getTemplate({
					name: type,
					submodule: CONFIG.submoduleName,
					data: {
						faxboxes: vars.faxboxes,
						count: _.size(vars.faxboxes)
					}
				}));

			self.faxInitDatePickerFaxboxes(type, $container, template);
			self.faxBindFaxboxes(type, template);

			$container
				.empty()
				.append(template)
				.show();
		},

		faxGetFaxBoxes: function (callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxGetFaxDetails: function(type, faxId, callback) {
			var self = this,
				resourceName = 'faxes.' + (type === 'inbound' ? 'getDetailsInbound' : 'getDetailsOutbound');

			self.callApi({
				resource: resourceName,
				data: {
					accountId: self.accountId,
					faxId: faxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxInitDatePickerFaxboxes: function(type, parent, template) {
			var self = this,
				dates = monster.util.getDefaultRangeDates(vars.ranges.default),
				fromDate = dates.from,
				toDate = dates.to;

			var optionsDatePicker = {
				container: template,
				range: vars.ranges.max
			};

			monster.ui.initRangeDatepicker(optionsDatePicker);

			template.find('#startDate').datepicker('setDate', fromDate);
			template.find('#endDate').datepicker('setDate', toDate);

			template.find('.apply-filter').on('click', function(e) {
				var faxboxId = template.find('#select_faxbox').val();

				self.faxDisplayListFaxes(type, parent, faxboxId);
			});

			template.find('.toggle-filter').on('click', function() {
				template.find('.filter-by-date').toggleClass('active');
			});
		},

		faxBindFaxboxes: function(type, template) {
			var self = this,
				$selectFaxbox = template.find('.select-faxbox'),
				i18nFax = self.i18n.active().userdashboard.submodules.fax;

			monster.ui.tooltips(template);
			monster.ui.footable(template.find('.footable'));

			monster.ui.chosen($selectFaxbox, {
				placeholder_text_single: i18nFax.actionBar.selectFaxbox.none
			});

			$selectFaxbox.on('change', function() {
				var faxboxId = $(this).val();

				template.find('.select-faxbox').val(faxboxId).trigger('chosen:updated');

				self.faxDisplayListFaxes(type, template, faxboxId);
			});

			template.find('#refresh_faxbox').on('click', function() {
				var faxboxId = $selectFaxbox.val();

				if (faxboxId !== 'none') {
					self.faxDisplayListFaxes(type, template, faxboxId);
				}
			});

			template.find('#delete_faxes').on('click', function() {
				var faxboxId = $selectFaxbox.val(),
					listSelected = [],
					type = $(this).data('type');

				template.find('.select-fax:checked').each(function(a, el) {
					listSelected.push($(el).data('id'));
				});
				var content = self.getTemplate({
					name: '!' + i18nFax.deleteConfirm.content,
					submodule: CONFIG.submoduleName,
					data: {
						variable: listSelected.length
					}
				});

				monster.ui.confirm(content, function() {
					template.find('.select-fax:checked').each(function(a, el) {
						listSelected.push($(el).data('id'));
					});

					template.find('.data-state')
						.hide();

					template.find('.loading-state')
						.show();

					self.deleteFaxes(listSelected, type, function() {
						monster.ui.toast({
							type: 'success',
							message: i18nFax.deleteConfirm.success
						});

						self.faxDisplayListFaxes(type, template, faxboxId);
					});
				}, undefined, {
					title: i18nFax.deleteConfirm.title,
					confirmButtonText: i18nFax.deleteConfirm.confirmButtonText,
					confirmButtonClass: 'monster-button-danger'
				});
			});

			template.find('#resend_faxes').on('click', function() {
				var faxboxId = $selectFaxbox.val(),
					listSelected = [];

				template.find('.select-fax:checked').each(function(a, el) {
					listSelected.push($(el).data('id'));
				});

				var content = self.getTemplate({
					name: '!' + i18nFax.resendConfirm.content,
					submodule: CONFIG.submoduleName,
					data: {
						variable: listSelected.length
					}
				});
				monster.ui.confirm(content, function() {
					self.resendFaxes(listSelected, function() {
						monster.ui.toast({
							type: 'success',
							message: i18nFax.resendConfirm.success
						});

						self.faxDisplayListFaxes(type, template, faxboxId);
					});
				}, undefined, {
					title: i18nFax.resendConfirm.title,
					confirmButtonText: i18nFax.resendConfirm.confirmButtonText
				});
			});

			template.on('click', '.details-fax', function() {
				var id = $(this).parents('tr').data('id');

				self.faxRenderDetailsFax(type, id);
			});

			function afterSelect() {
				if (template.find('.select-fax:checked').length) {
					template.find('.hidable').removeClass('hidden');
					template.find('.main-select-fax').prop('checked', true);
				} else {
					template.find('.hidable').addClass('hidden');
					template.find('.main-select-fax').prop('checked', false);
				}
			}

			template.on('click', '.select-fax', function() {
				afterSelect();
			});

			template.find('.main-select-fax').on('click', function() {
				var $this = $(this),
					isChecked = $this.prop('checked');

				template.find('.select-fax').prop('checked', isChecked);

				afterSelect();
			});

			template.find('.select-some-faxes').on('click', function() {
				var $this = $(this),
					type = $this.data('type');

				template.find('.select-fax').prop('checked', false);

				if (type !== 'none') {
					if (type === 'all') {
						template.find('.select-fax').prop('checked', true);
					} else {
						template.find('.select-fax[data-status="' + type + '"]').prop('checked', true);
					}
				}

				afterSelect();
			});

			template.on('click', '.select-line', function() {
				var cb = $(this).parents('.fax-row').find('.select-fax');

				cb.prop('checked', !cb.prop('checked'));
				afterSelect();
			});
		},
		faxDisplayListFaxes: function(type, container, faxboxId) {
			var self = this,
				fromDate = container.find('input.filter-from').datepicker('getDate'),
				toDate = container.find('input.filter-to').datepicker('getDate'),
				filterByDate = container.find('.filter-by-date').hasClass('active');

			container.removeClass('empty');

			// Gives a better feedback to the user if we empty it as we click... showing the user something is happening.
			container.find('.data-state')
				.hide();

			container.find('.loading-state')
				.show();

			container.find('.hidable').addClass('hidden');
			container.find('.main-select-fax').prop('checked', false);

			monster.ui.footable(container.find('.faxbox-table .footable'), {
				getData: function(filters, callback) {
					if (filterByDate) {
						filters = $.extend(true, filters, {
							created_from: monster.util.dateToBeginningOfGregorianDay(fromDate),
							created_to: monster.util.dateToEndOfGregorianDay(toDate)
						});
					}
					// we do this to keep context
					self.faxGetRowsFaxes(type, filters, faxboxId, callback);
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

		faxGetRowsFaxes: function(type, filters, faxboxId, callback) {
			var self = this;

			self.faxGetFaxMessages(type, filters, faxboxId, function(data) {
				var formattedData = self.faxFormatFaxData(data.data, type),
					dataTemplate = {
						faxes: formattedData
					},
					$rows = $(self.getTemplate({
						name: type + '-rows',
						submodule: CONFIG.submoduleName,
						data: dataTemplate
					}));

				callback && callback($rows, data);
			});
		},

		faxGetFaxMessages: function(type, filters, faxboxId, callback) {
			var self = this,
				resource = type === 'inbound' ? 'faxes.listInbound' : 'faxes.listOutbound';

			self.callApi({
				resource: resource,
				data: {
					accountId: self.accountId,
					//faxboxId: faxboxId, API Doesn't allow filter here for now, we'll do it in JS instead
					filters: filters
				},
				success: function(data) {
					var formattedData = data,
						filteredData = _.filter(data.data, function(a) {
							return a.faxbox_id === faxboxId;
						});

					formattedData.data = filteredData;

					callback && callback(formattedData);
				}
			});
		},

		faxFormatFaxData: function(data, type) {
			var self = this;

			_.each(data, function(fax) {
				var details = fax.hasOwnProperty('rx_result') ? fax.rx_result : (fax.hasOwnProperty('tx_result') ? fax.tx_result : {});

				fax.status = details.success === true ? 'success' : 'failed';
				fax.formatted = {};

				if (details.success === false) {
					fax.formatted.error = details.result_text;
				}

				fax.formatted.timestamp = monster.util.toFriendlyDate(fax.created);
				fax.formatted.receivingFaxbox = vars.faxboxes.hasOwnProperty(fax.faxbox_id) ? vars.faxboxes[fax.faxbox_id].name : '-';
				fax.formatted.receivingNumber = monster.util.formatPhoneNumber(fax.to_number);
				fax.formatted.sendingFaxbox = vars.faxboxes.hasOwnProperty(fax.faxbox_id) ? vars.faxboxes[fax.faxbox_id].name : '-';
				fax.formatted.sendingNumber = monster.util.formatPhoneNumber(fax.from_number);
				fax.formatted.pages = details.hasOwnProperty('total_pages') ? details.total_pages : 0;
				fax.formatted.uri = self.faxFormatFaxURI(fax.id, type);
			});

			return data;
		},

		faxFormatFaxURI: function(mediaId, pType) {
			var self = this,
				type = pType === 'inbound' ? 'inbox' : 'outbox';

			return self.apiUrl + 'accounts/' + self.accountId + '/faxes/' + type + '/' + mediaId + '/attachment?auth_token=' + self.getAuthToken();
		},

		faxRenderDetailsFax: function(type, id) {
			var self = this;

			self.faxGetFaxDetails(type, id, function(faxDetails) {
				var template = $(self.getTemplate({
					name: 'CDRDialog',
					submodule: CONFIG.submoduleName,
				}));

				monster.ui.renderJSON(faxDetails, template.find('#jsoneditor'));

				monster.ui.dialog(template, { title: self.i18n.active().userdashboard.submodules.fax.CDRPopup.title });
			});
		},

		faxLogsFormatDataTable: function(logs) {
			_.each(logs, function(log) {
				log.formatted = {};
				log.formatted.hasError = log.hasOwnProperty('error');
				log.formatted.from = log.from || '-';
				log.formatted.to = log.to || '-';
				log.formatted.date = monster.util.toFriendlyDate(log.created);
			});

			return logs;
		},

		faxLogsBindEvents: function(template) {
			var self = this;

			template.on('click', '.detail-link', function() {
				var logId = $(this).parents('tr').data('id');

				self.faxLogsRenderDetailPopup(logId);
			});
		},

		faxLogsRenderDetailPopup: function(logId) {
			var self = this;

			self.faxLogsGetDetails(logId, function(details) {
				var detailTemplate = $(self.getTemplate({
					name: 'emailToFaxLogDetail',
					submodule: CONFIG.submoduleName,
					data: details
				}));

				detailTemplate.find('#close').on('click', function() {
					popup.dialog('close').remove();
				});

				var popup = monster.ui.dialog(detailTemplate, {
					title: self.i18n.active().userdashboard.submodules.fax.logs.detailDialog.popupTitle,
					position: ['center', 20]
				});
			});
		},

		faxLogsGetData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'faxes.getLogs',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		faxLogsGetDetails: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'faxes.getLogDetails',
				data: {
					accountId: self.accountId,
					logId: id
				},
				success: function(data) {
					var formattedData = self.faxLogsFormatDetailData(data.data);

					callback && callback(formattedData);
				}
			});
		},

		faxLogsFormatDetailData: function(details) {
			var self = this,
				formattedData = {
					metadata: {},
					errors: []
				},
				formattedKey = '';

			_.each(details, function(value, key) {
				if (key === 'errors') {
					formattedData.errors = value;
				} else {
					var i18nFax = self.i18n.active().userdashboard.submodules.fax;
					formattedKey = i18nFax.logs.detailDialog.apiKeys.hasOwnProperty(key) ? i18nFax.logs.detailDialog.apiKeys[key] : key.replace(/_/g, ' ');
					formattedData.metadata[key] = {
						friendlyKey: formattedKey,
						value: value
					};
				}
			});

			return formattedData;
		},
	};

	return app;
});
