'use strict';

console.log('[ieu-cancel-sub] main.js loaded');

// The card is drawn from the last known status right away (no layout jump while the request runs),
// then refreshed in place when the payment service answers. Cache is per user, 7 days at most.
var IEU_CS_CACHE_DAYS = 7;
function ieuCsCacheKey() { return 'ieu-cs:' + config.uid; }
function ieuCsReadCache() {
	try {
		var c = JSON.parse(localStorage.getItem(ieuCsCacheKey()) || 'null');
		if (c && c.data && c.at > Date.now() - IEU_CS_CACHE_DAYS * 864e5) {
			var d = $.extend({}, c.data);
			delete d.remainingDays; // recomputed from expiresAt, the cached number is stale
			return d;
		}
	} catch (e) { /* storage blocked: no instant card */ }
	return null;
}
function ieuCsWriteCache(data) {
	try {
		if (data && data.active) localStorage.setItem(ieuCsCacheKey(), JSON.stringify({ at: Date.now(), data: data }));
		else localStorage.removeItem(ieuCsCacheKey());
	} catch (e) { /* ignore */ }
}
function ieuCsRender(data, fromCache) {
	var old = document.getElementById('ieu-subscription-card');
	var html = buildCardHTML(data);
	if (old) {
		$(old).replaceWith($(html).addClass('ieu-cs-still'));
	} else {
		injectCard(html);
		if (fromCache) $('#ieu-subscription-card').addClass('ieu-cs-still');
	}
	bindCancelButton(data);
}
function ieuCsRemove() {
	$('#ieu-subscription-card').remove();
	$('.account-content').removeClass('ieu-cs-has-card');
}

$(window).on('action:ajaxify.end', function () {
	var url = ajaxify.data && ajaxify.data.url;
	if (!url || !url.startsWith('/user/')) return;
	if (!config.loggedIn || !config.uid) return;
	if (!ajaxify.data.isSelf) return;
	// only on the profile's About page, not on the Topics/Posts/Groups... tabs that share the /user/ layout
	if (!ajaxify.data.template || !ajaxify.data.template['account/profile']) return;
	if (!document.querySelector('[component="aboutme"], [component="account/profile"], .account-content')) return;

	var cached = ieuCsReadCache();
	if (cached && !document.getElementById('ieu-subscription-card')) ieuCsRender(cached, true);

	$.ajax({
		url: config.relative_path + '/api/ieu-subscription-status',
		method: 'GET',
		headers: { 'x-csrf-token': config.csrf_token },
	}).done(function (result) {
		if (!result || !result.status || result.status.code !== 'ok') return;
		var data = result.response;
		ieuCsWriteCache(data);
		if (!data || !data.active) { ieuCsRemove(); return; }
		ieuCsRender(data, false);
	}).fail(function (err) {
		console.error('[ieu-cancel-sub] status request failed:', err.statusText);
	});
});

// Profile V4 membership card (2026-10-25): a card per tier (Lite grey, Premium purple, VIP orange),
// floated to the right of the bio, with the plan, end date and days left on the card itself.
function buildCardHTML(data) {
	var periodLabels = { monthly: 'Aylık', yearly: 'Yıllık' };
	var periodLabel = periodLabels[data.period] || data.period || '';
	var plan = String(data.plan || '').toLowerCase();
	var tier = { lite: 'LITE', premium: 'PREMIUM', vip: 'VIP' }[plan] || String(data.planName || plan).toUpperCase();
	var daysRemaining = data.remainingDays != null ? data.remainingDays : computeDaysRemaining(data.expiresAt);
	var expiresFormatted = data.expiresAt ? formatDateTR(data.expiresAt) : '';
	var cancelRequested = !!data.cancelRequestedAt || !data.autoRenew;
	var showCancelButton = !!data.autoRenew && !data.cancelRequestedAt;
	var u = ajaxify.data || {};
	var name = u.fullname || u.displayname || u.username || '';
	var payUrl = config.relative_path + '/pay/checkout?uid=' + encodeURIComponent(config.uid);
	var logoEl = document.querySelector('[component="brand/logo"]');
	var logo = logoEl && logoEl.getAttribute('src');
	var up = { lite: ['main', "Premium'a geç", payUrl], premium: ['vip', "VIP'ye geç · daha fazla AI", config.relative_path + '/pay/checkout/upgrade?uid=' + encodeURIComponent(config.uid) + '&plan=vip'] }[plan];

	var h = '';
	h += '<div class="ieu-cs-v4 ieu-cs-mb-3" id="ieu-subscription-card"';
	h += ' data-days-remaining="' + daysRemaining + '"';
	h += ' data-auto-renew="' + !!data.autoRenew + '"';
	h += ' data-expires-formatted="' + escapeHtml(expiresFormatted) + '">';
	h += '<div class="ieu-cs-idcard ' + escapeHtml(plan) + '">';
	h += '<div class="top">' + (logo ? '<img src="' + escapeHtml(logo) + '" alt="">' : '') + 'IEU Forum</div>';
	h += '<div class="tier">' + escapeHtml(tier) + '</div>';
	h += '<div class="chip"></div>';
	h += '<div class="who">' + escapeHtml(name) + '</div>';
	h += '<div class="dept">@' + escapeHtml(u.username || '') + '</div>';
	h += '<div class="meta"><span>Plan<b>' + escapeHtml(periodLabel || '-') + '</b></span>';
	h += '<span>Bitiş<b>' + escapeHtml(expiresFormatted || '-') + '</b></span>';
	h += '<span>Kalan<b class="' + (daysRemaining <= 3 ? 'ieu-cs-text-danger-soft' : '') + '">' + daysRemaining + ' gün</b></span></div>';
	h += '</div>';

	// target=_top: /pay/* is the payment app, not a NodeBB route, so ajaxify must not open it (it shows 404)
	h += '<div class="ieu-cs-actions"><a target="_top" href="' + payUrl + '">Planımı yönet</a>';
	if (up) h += '<a target="_top" class="' + up[0] + '" href="' + up[2] + '">' + up[1] + '</a>';
	h += '</div>';

	if (daysRemaining <= 3 && !cancelRequested) {
		h += '<div class="ieu-cs-alert ieu-cs-alert-warning">Aboneliğin ' + daysRemaining + ' gün sonra yenilenecek.</div>';
	}
	if (cancelRequested) {
		h += '<div class="ieu-cs-alert ieu-cs-alert-info">Otomatik yenileme kapalı. Üyeliğin ' + escapeHtml(expiresFormatted) + ' tarihine kadar açık.</div>';
	}
	if (showCancelButton) {
		h += '<div id="ieu-cancel-action"><button id="ieu-cancel-btn" type="button" class="ieu-cs-v4-cancel">Aboneliğimi iptal et</button></div>';
	}
	h += '<div id="ieu-cancel-result" class="ieu-cs-hidden"></div>';
	h += '</div>';
	return h;
}

function injectCard(html) {
	var box = document.querySelector('.account-content');
	var about = document.querySelector('[component="aboutme"]');
	if (box && about && about.parentElement === box) {
		$(about).after(html);
		box.classList.add('ieu-cs-has-card');
		return;
	}
	if (box) {
		$(box).append(html);
		box.classList.add('ieu-cs-has-card');
		return;
	}
	var profile = document.querySelector('[component="account/profile"]');
	$(profile || '#content').append(html);
}

function bindCancelButton(data) {
	var btn = document.getElementById('ieu-cancel-btn');
	if (!btn) return;

	console.log('[ieu-cancel-sub] İptal butonu bulundu, handler bağlanıyor');

	$(btn).on('click', function () {
		var card = document.getElementById('ieu-subscription-card');
		var exp = card && card.dataset.expiresFormatted || '';

		showConfirmModal(
			'Abonelik İptali',
			'Otomatik yenilemeyi iptal etmek istediğinizden emin misiniz?<br><small class="ieu-cs-text-muted">Aboneliğiniz mevcut dönem sonuna kadar (' + escapeHtml(exp) + ') aktif kalacaktır.</small>',
			function () {
				btn.disabled = true;
				btn.innerHTML = '<span class="ieu-cs-spinner ieu-cs-spinner-sm"></span> İşleniyor...';

				$.ajax({
					url: config.relative_path + '/api/ieu-cancel-subscription',
					method: 'POST',
					contentType: 'application/json',
					headers: { 'x-csrf-token': config.csrf_token },
				}).done(function (d) {
					console.log('[ieu-cancel-sub] İptal yanıtı:', JSON.stringify(d));
					if (d.status && d.status.code === 'ok') {
						var action = document.getElementById('ieu-cancel-action');
						if (action) action.classList.add('ieu-cs-hidden');

						var result = document.getElementById('ieu-cancel-result');
						if (result) {
							result.classList.remove('ieu-cs-hidden');
							result.innerHTML = '<div class="ieu-cs-alert ieu-cs-alert-success">\u2713 Otomatik yenileme iptal edildi. Aboneliğiniz ' + d.response.daysRemaining + ' gün sonra sona erecektir.</div>';
						}
					} else {
						showAlertModal('Hata', (d.status && d.status.message) || 'Bir hata oluştu', 'danger');
						btn.disabled = false;
						btn.textContent = 'Aboneliğimi İptal Et';
					}
				}).fail(function () {
					showAlertModal('Bağlantı Hatası', 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.', 'danger');
					btn.disabled = false;
					btn.textContent = 'Aboneliğimi İptal Et';
				});
			}
		);
	});
}

// ─── Modal Helpers (Bootstrap bağımsız, custom toggle) ───────────────

function closeIeuCsModal() {
	var $modal = $('#ieu-modal');
	var $backdrop = $('.ieu-cs-modal-backdrop');
	$modal.removeClass('ieu-cs-modal--open');
	$backdrop.removeClass('ieu-cs-modal-backdrop--open');
	$(document).off('keydown.ieuCsModal');
	setTimeout(function () {
		$modal.remove();
		$backdrop.remove();
	}, 150);
}

function openIeuCsModal(modalHtml, onConfirm) {
	$('#ieu-modal').remove();
	$('.ieu-cs-modal-backdrop').remove();

	$('body').append('<div class="ieu-cs-modal-backdrop"></div>');
	$('body').append(modalHtml);

	var $modal = $('#ieu-modal');
	var $backdrop = $('.ieu-cs-modal-backdrop');

	requestAnimationFrame(function () {
		$backdrop.addClass('ieu-cs-modal-backdrop--open');
		$modal.addClass('ieu-cs-modal--open');
	});

	$modal.on('click', '.ieu-cs-modal-dismiss', closeIeuCsModal);
	$backdrop.on('click', closeIeuCsModal);
	$(document).on('keydown.ieuCsModal', function (e) {
		if (e.key === 'Escape') closeIeuCsModal();
	});

	if (onConfirm) {
		$('#ieu-modal-confirm').one('click', function () {
			closeIeuCsModal();
			onConfirm();
		});
	}
}

function showConfirmModal(title, message, onConfirm) {
	var modal = '';
	modal += '<div class="ieu-cs-modal" id="ieu-modal" tabindex="-1" role="dialog">';
	modal += '<div class="ieu-cs-modal-dialog">';
	modal += '<div class="ieu-cs-modal-content">';
	modal += '<div class="ieu-cs-modal-header">';
	modal += '<h5 class="ieu-cs-modal-title">' + title + '</h5>';
	modal += '<button type="button" class="ieu-cs-btn-close ieu-cs-modal-dismiss" aria-label="Kapat"></button>';
	modal += '</div>';
	modal += '<div class="ieu-cs-modal-body"><p>' + message + '</p></div>';
	modal += '<div class="ieu-cs-modal-footer">';
	modal += '<button type="button" class="ieu-cs-btn ieu-cs-btn-secondary ieu-cs-modal-dismiss">Vazgeç</button>';
	modal += '<button type="button" class="ieu-cs-btn ieu-cs-btn-danger" id="ieu-modal-confirm">Evet, İptal Et</button>';
	modal += '</div>';
	modal += '</div></div></div>';

	openIeuCsModal(modal, onConfirm);
}

function showAlertModal(title, message, type) {
	var iconMap = {
		danger: '<i class="fa fa-exclamation-circle ieu-cs-text-danger"></i>',
		success: '<i class="fa fa-check-circle ieu-cs-text-success"></i>',
		warning: '<i class="fa fa-exclamation-triangle ieu-cs-text-warning"></i>',
	};
	var icon = iconMap[type] || '';

	var modal = '';
	modal += '<div class="ieu-cs-modal" id="ieu-modal" tabindex="-1" role="dialog">';
	modal += '<div class="ieu-cs-modal-dialog ieu-cs-modal-dialog-sm">';
	modal += '<div class="ieu-cs-modal-content">';
	modal += '<div class="ieu-cs-modal-header">';
	modal += '<h5 class="ieu-cs-modal-title">' + icon + title + '</h5>';
	modal += '<button type="button" class="ieu-cs-btn-close ieu-cs-modal-dismiss" aria-label="Kapat"></button>';
	modal += '</div>';
	modal += '<div class="ieu-cs-modal-body"><p>' + message + '</p></div>';
	modal += '<div class="ieu-cs-modal-footer">';
	modal += '<button type="button" class="ieu-cs-btn ieu-cs-btn-primary ieu-cs-modal-dismiss">Tamam</button>';
	modal += '</div>';
	modal += '</div></div></div>';

	openIeuCsModal(modal, null);
}

function formatDateTR(isoString) {
	var date = new Date(isoString);
	return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function computeDaysRemaining(expiresAt) {
	var now = new Date();
	var diffMs = new Date(expiresAt).getTime() - now.getTime();
	return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Material reward popups ──────────────────────────────────────────
// 1) Right after a new topic in Ders Notları (5) / Soru Tipleri (10): what happens next.
// 2) A refusal sent by the payment service: shown once, on the next page or as soon as the bell rings.
var IEU_MAT_CIDS = [5, 10];

function ieuMatModal(title, html, buttons) {
	var modal = '';
	modal += '<div class="ieu-cs-modal" id="ieu-modal" tabindex="-1" role="dialog">';
	modal += '<div class="ieu-cs-modal-dialog ieu-cs-modal-dialog-sm"><div class="ieu-cs-modal-content">';
	modal += '<div class="ieu-cs-modal-header"><h5 class="ieu-cs-modal-title">' + title + '</h5>';
	modal += '<button type="button" class="ieu-cs-btn-close ieu-cs-modal-dismiss" aria-label="Kapat"></button></div>';
	modal += '<div class="ieu-cs-modal-body">' + html + '</div>';
	modal += '<div class="ieu-cs-modal-footer">' + (buttons || '') + '<button type="button" class="ieu-cs-btn ieu-cs-btn-primary ieu-cs-modal-dismiss">Tamam</button></div>';
	modal += '</div></div></div>';
	openIeuCsModal(modal, null);
}

$(window).on('action:composer.topics.post', function (ev, payload) {
	var topic = payload && payload.data;
	if (!topic || IEU_MAT_CIDS.indexOf(parseInt(topic.cid, 10)) < 0) return;
	ieuMatModal('🎉 Materyalin alındı',
		'<p>3 saat içinde incelenir, sonucu bildirim olarak gelir.</p>',
		'<a class="ieu-cs-btn ieu-cs-btn-outline ieu-cs-modal-dismiss" href="' + config.relative_path + '/material-info">Kurallar</a>');
});

var ieuMatBusy = false;
function ieuMatCheck() {
	if (!config.loggedIn || ieuMatBusy || document.getElementById('ieu-modal')) return;
	ieuMatBusy = true;
	fetch(config.relative_path + '/api/v3/plugins/ieu-material/popup', { credentials: 'same-origin' })
		.then(function (r) { return r.ok ? r.json() : null; })
		.then(function (d) {
			var p = d && d.response && d.response.popups && d.response.popups[d.response.popups.length - 1];
			if (!p) return;
			var links = (p.topic ? '<a class="ieu-cs-btn ieu-cs-btn-outline ieu-cs-modal-dismiss" href="' + config.relative_path + escapeHtml(p.topic) + '">' + escapeHtml(p.topicLabel || 'Konuya git') + '</a>' : '') +
				(p.guide ? '<a class="ieu-cs-btn ieu-cs-btn-outline ieu-cs-modal-dismiss" href="' + config.relative_path + escapeHtml(p.guide) + '">Kurallar</a>' : '');
			ieuMatModal(escapeHtml(p.title || 'Materyal'), '<p>' + escapeHtml(p.text) + '</p>', links);
		})
		.catch(function () { /* try again on the next page */ })
		.then(function () { ieuMatBusy = false; });
}

var ieuMatStarted = false;
$(window).on('action:ajaxify.end', function () {
	if (ieuMatStarted) return;
	ieuMatStarted = true;
	ieuMatCheck();
	if (window.socket && socket.on) {
		socket.on('event:new_notification', function (n) {
			if (n && /^ieu-material:refused:/.test(String(n.nid || ''))) ieuMatCheck();
		});
	}
});
