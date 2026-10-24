'use strict';

console.log('[ieu-cancel-sub] main.js loaded');

$(window).on('action:ajaxify.end', function () {
	var url = ajaxify.data && ajaxify.data.url;
	if (!url || !url.startsWith('/user/')) return;
	if (!config.loggedIn || !config.uid) return;
	if (!ajaxify.data.isSelf) return;

	// Zaten eklenmişse tekrar ekleme
	if (document.getElementById('ieu-subscription-card')) return;

	console.log('[ieu-cancel-sub] Profil sayfası, abonelik durumu sorgulanıyor...');

	$.ajax({
		url: config.relative_path + '/api/ieu-subscription-status',
		method: 'GET',
		headers: { 'x-csrf-token': config.csrf_token },
	}).done(function (result) {
		console.log('[ieu-cancel-sub] API yanıtı:', JSON.stringify(result));

		if (!result || result.status.code !== 'ok') {
			console.log('[ieu-cancel-sub] API hatası, kart gösterilmiyor');
			return;
		}

		var data = result.response;
		if (!data || !data.active) {
			console.log('[ieu-cancel-sub] Aktif abonelik yok');
			return;
		}

		var html = buildCardHTML(data);
		injectCard(html);
		bindCancelButton(data);
	}).fail(function (err) {
		console.error('[ieu-cancel-sub] API isteği başarısız:', err.statusText);
	});
});

function buildCardHTML(data) {
	var periodLabels = { monthly: 'Aylık', yearly: 'Yıllık' };
	var periodLabel = periodLabels[data.period] || data.period || '';
	var planName = data.planName || data.plan || '';
	var daysRemaining = data.remainingDays != null ? data.remainingDays : computeDaysRemaining(data.expiresAt);
	var expiresFormatted = data.expiresAt ? formatDateTR(data.expiresAt) : '';
	var cancelRequested = !!data.cancelRequestedAt || !data.autoRenew;
	var showCancelButton = !!data.autoRenew && !data.cancelRequestedAt;

	var h = '';
	h += '<div class="ieu-cs-card ieu-cs-mb-3" id="ieu-subscription-card"';
	h += ' data-days-remaining="' + daysRemaining + '"';
	h += ' data-auto-renew="' + !!data.autoRenew + '"';
	h += ' data-expires-formatted="' + escapeHtml(expiresFormatted) + '">';
	h += '<div class="ieu-cs-card-header">Abonelik Durumu</div>';
	h += '<div class="ieu-cs-card-body">';

	h += '<div class="ieu-cs-mb-2"><span class="ieu-cs-text-muted">Plan:</span> <strong>' + escapeHtml(planName) + '</strong>';
	if (periodLabel) {
		h += ' <span class="ieu-cs-text-muted">(' + escapeHtml(periodLabel) + ')</span>';
	}
	h += '</div>';

	if (expiresFormatted) {
		h += '<div class="ieu-cs-mb-2"><span class="ieu-cs-text-muted">Bitiş Tarihi:</span> <strong>' + escapeHtml(expiresFormatted) + '</strong></div>';
		h += '<div class="ieu-cs-mb-2"><span class="ieu-cs-text-muted">Kalan Süre:</span> <strong id="ieu-days-value" class="' + (daysRemaining <= 3 ? 'ieu-cs-text-danger' : '') + '">' + daysRemaining + ' gün</strong></div>';
	}

	if (daysRemaining <= 3) {
		h += '<div class="ieu-cs-alert ieu-cs-alert-warning ieu-cs-mb-2">Aboneliğiniz ' + daysRemaining + ' gün sonra sona erecek!</div>';
	}

	if (cancelRequested) {
		h += '<div class="ieu-cs-alert ieu-cs-alert-info ieu-cs-mb-2">Otomatik yenileme iptal edildi. Aboneliğiniz ' + daysRemaining + ' gün sonra sona erecektir.</div>';
	}

	if (showCancelButton) {
		h += '<div id="ieu-cancel-action" class="ieu-cs-mt-3">';
		h += '<button id="ieu-cancel-btn" class="ieu-cs-btn ieu-cs-btn-outline-danger">Aboneliğimi İptal Et</button>';
		h += '</div>';
	}

	h += '<div id="ieu-cancel-result" class="ieu-cs-hidden ieu-cs-mt-3"></div>';
	h += '</div></div>';

	return h;
}

function injectCard(html) {
	// 1. Widget alanı varsa oraya ekle (en iyi konum)
	var target = document.querySelector('[data-widget-area="profile-aboutme-before"]');
	if (target) {
		$(target).prepend(html);
		console.log('[ieu-cancel-sub] Kart profile-aboutme-before alanına eklendi');
		return;
	}

	// 2. Aboutme bölümünden önce ekle
	var aboutme = document.querySelector('[component="aboutme"]') ||
		document.querySelector('.aboutme');
	if (aboutme) {
		$(aboutme).before(html);
		console.log('[ieu-cancel-sub] Kart aboutme bölümünden önce eklendi');
		return;
	}

	// 3. Profil istatistik kartlarından sonra ekle
	var profile = document.querySelector('[component="account/profile"]');
	if (profile) {
		var statRow = profile.querySelector('.d-flex.gap-2.flex-wrap') ||
			profile.querySelector('.stats');
		if (statRow) {
			$(statRow).after(html);
			console.log('[ieu-cancel-sub] Kart stat satırından sonra eklendi');
			return;
		}
		// Profil içerik alanının sonuna ekle (üste binmesin diye append)
		$(profile).append(html);
		console.log('[ieu-cancel-sub] Kart profil alanının sonuna eklendi');
		return;
	}

	// 4. Son çare
	$('#content').append(html);
	console.log('[ieu-cancel-sub] Kart #content alanına eklendi');
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
