function initDateFilter() {
  const form = document.getElementById("dateForm");
  const hiddenDate = document.getElementById("dateHidden");
  const pickerInput = document.getElementById("datePicker");
  const mobileInput = document.getElementById("mobileDatePicker");
  const btn = document.getElementById("calendarBtn");
  const sheet = document.getElementById("dateSheet");

  if (!form || !pickerInput || !hiddenDate || !btn) return;

  const isMobile = window.innerWidth < 768;

  function submitWith(date) {
    hiddenDate.value = date;
    form.submit();
  }

  const desktopFp = flatpickr(pickerInput, {
    locale: flatpickr.l10ns.pl,
    dateFormat: "Y-m-d",
    disableMobile: true,
    clickOpens: false,
    defaultDate: hiddenDate.value || null,
    positionElement: btn,
    position: "below",
    onChange: d => submitWith(desktopFp.formatDate(d[0], "Y-m-d"))
  });

  if (mobileInput) {
    flatpickr(mobileInput, {
      locale: flatpickr.l10ns.pl,
      dateFormat: "Y-m-d",
      inline: true,
      defaultDate: hiddenDate.value || null,
      onChange: d => {
        closeDateSheet();
        const selected = d[0];
        const year = selected.getFullYear();
        const month = String(selected.getMonth() + 1).padStart(2, "0");
        const day = String(selected.getDate()).padStart(2, "0");

        submitWith(`${year}-${month}-${day}`);
      }
    });
  }

  btn.addEventListener("click", () => {
    isMobile ? openDateSheet() : desktopFp.open();
  });
}

function openDateSheet() {
  document.getElementById("dateSheet")?.classList.remove("hidden");
}

function closeDateSheet() {
  document.getElementById("dateSheet")?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", initDateFilter);