<!-- IF isSelf -->
<!-- IF ieuSubscription.active -->
<div class="ieu-cs-card ieu-cs-mb-3" id="ieu-subscription-card"
     data-days-remaining="{ieuSubscription.daysRemaining}"
     data-auto-renew="{ieuSubscription.autoRenew}"
     data-expires-formatted="{ieuSubscription.expiresAtFormatted}">
  <div class="ieu-cs-card-header">
    Abonelik Durumu
  </div>
  <div class="ieu-cs-card-body">

    <!-- Plan ve Periyot -->
    <div class="ieu-cs-mb-2">
      <span class="ieu-cs-text-muted">Plan:</span>
      <strong>{ieuSubscription.planName}</strong>
      <!-- IF !ieuSubscription.statusFetchFailed -->
      <span class="ieu-cs-text-muted">({ieuSubscription.periodLabel})</span>
      <!-- ENDIF !ieuSubscription.statusFetchFailed -->
    </div>

    <!-- Detaylı bilgi — sadece API başarılıysa -->
    <!-- IF !ieuSubscription.statusFetchFailed -->

    <div class="ieu-cs-mb-2">
      <span class="ieu-cs-text-muted">Bitiş Tarihi:</span>
      <strong>{ieuSubscription.expiresAtFormatted}</strong>
    </div>

    <div class="ieu-cs-mb-2" id="ieu-days-remaining">
      <span class="ieu-cs-text-muted">Kalan Süre:</span>
      <strong id="ieu-days-value">{ieuSubscription.daysRemaining} gün</strong>
    </div>

    <!-- Düşük gün uyarısı -->
    <!-- IF ieuSubscription.daysWarning -->
    <div class="ieu-cs-alert ieu-cs-alert-warning ieu-cs-mb-2" id="ieu-days-warning">
      Aboneliğiniz {ieuSubscription.daysRemaining} gün sonra sona erecek!
    </div>
    <!-- ENDIF ieuSubscription.daysWarning -->

    <!-- İptal edilmiş durum -->
    <!-- IF ieuSubscription.cancelRequested -->
    <div class="ieu-cs-alert ieu-cs-alert-info ieu-cs-mb-2" id="ieu-cancel-info">
      Otomatik yenileme iptal edildi.
      Aboneliğiniz {ieuSubscription.daysRemaining} gün sonra sona erecektir.
    </div>
    <!-- ENDIF ieuSubscription.cancelRequested -->

    <!-- ENDIF !ieuSubscription.statusFetchFailed -->

    <!-- İptal butonu — sadece autoRenew=true ve iptal edilmemişse -->
    <!-- IF ieuSubscription.showCancelButton -->
    <div id="ieu-cancel-action" class="ieu-cs-mt-3">
      <button id="ieu-cancel-btn" class="ieu-cs-btn ieu-cs-btn-outline-danger">
        Aboneliğimi İptal Et
      </button>
    </div>
    <!-- ENDIF ieuSubscription.showCancelButton -->

    <!-- AJAX sonuç alanı -->
    <div id="ieu-cancel-result" class="ieu-cs-hidden ieu-cs-mt-3"></div>

  </div>
</div>
<!-- ENDIF ieuSubscription.active -->
<!-- ENDIF isSelf -->
