'use strict';
'require baseclass';
'require form';
'require fs';
'require view';
'require ui';
'require uci';
'require poll';
'require dom';

/*
  Copyright 2025 Rafał Wabik - IceG - From eko.one.pl forum

  MIT License
*/

let refresh = {
  interval: 5,         // normal => 5s
  labelEl: null,
  selectEl: null,
  lastSec: null
};

function setUpdateMessage(el, sec) {
  if (!el) return;

  if (sec < 0) {
    el.textContent = _('Disabled.');
    return;
  }

  if (sec === 0) {
    el.textContent = '';
    el.appendChild(E('em', { 'class': 'spinning' }, _('Refreshing') + '..'));
    return;
  }

  let tmpl = _('Updating again in %s second(s).');
  let parts = String(tmpl).split('%s');
  el.textContent = '';
  el.appendChild(document.createTextNode(parts[0] || ''));
  el.appendChild(E('b', {}, String(sec)));
  el.appendChild(document.createTextNode(parts[1] || ''));
}

async function loadUCInterval() {
  try {
    let savedInterval = await uci.get('modemdata', '@modemdata[0]', 'updtime');
    let interval = savedInterval ? parseInt(savedInterval, 10) : 5;

    let selectElement = document.getElementById('selectInterval');
    if (selectElement) {
      selectElement.value = interval;
    }

    refresh.interval = interval;

    if (interval > 0) {
      refresh.remaining = interval;
      refresh.lastSec = null;
      if (!poll.active()) poll.start();
    } else {
      poll.stop();
      refresh.remaining = null;
      setUpdateMessage(refresh.labelEl, -1);
    }
  } catch (err) {
    console.error('Error loading saved interval from UCI:', err);
  }
}

function clickToSelectInterval(ev) {
  let v = parseInt(ev.target.value, 10);
  if (isNaN(v)) return;

  refresh.interval = v;

  uci.set('modemdata', '@modemdata[0]', 'updtime', v.toString());
  uci.save();
  uci.apply();

  if (v > 0) {
    refresh.remaining = v;
    refresh.lastSec = null;
    if (!poll.active()) poll.start();
  } else {
    poll.stop();
    refresh.remaining = null;
    setUpdateMessage(refresh.labelEl, -1);
  }
}

// 1 sec tick
function updateDataTick(runFetchFn) {
  let tick = poll.tick || 0;
  let interval = refresh.interval > 0 ? refresh.interval : 0;

  let sec = interval > 0 ? interval - (tick % interval || interval) : -1;

  if (refresh.labelEl && sec !== refresh.lastSec) {
    setUpdateMessage(refresh.labelEl, sec);
    refresh.lastSec = sec;
  }

  if (interval && sec === 0 && typeof runFetchFn === 'function') {
    return runFetchFn();
  }

  return Promise.resolve();
}
function formatDuration(sec) {
  if (sec === '-' || sec === '') return '-';
  let d = Math.floor(sec / 86400),
      h = Math.floor(sec / 3600) % 24,
      m = Math.floor(sec / 60) % 60,
      s = sec % 60;
  let time = d > 0 ? d + 'd ' : '';
  if (time !== '') time += h + 'h ';
  else time = h > 0 ? h + 'h ' : '';
  if (time !== '') time += m + 'm ';
  else time = m > 0 ? m + 'm ' : '';
  time += s + 's';
  return time;
}

// See https://wiki.teltonika-networks.com/view/Mobile_Signal_Strength_Recommendations
function getSignalLabel(value, type) {
  let signalValue = parseFloat(value);
  if (isNaN(signalValue)) return { label: _('No data'), color: 'gray' };

  switch (type) {
    case 'RSSI':
      if (signalValue > -65) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -75) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -85) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSSI_wcdma':
      if (signalValue >= -70) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -85) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -100) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSRP':
      if (signalValue >= -80) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -90) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -100) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSRQ':
      if (signalValue >= -10) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -15) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -20) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'SINR':
      if (signalValue > 15) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= 10) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= 5) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'SNR':
      if (signalValue > 20) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= 13) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= 5) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSCP':
      if (signalValue >= -75) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -85) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -95) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'ECIO':
      if (signalValue >= -6 && signalValue <= 0) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -10) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -20) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    default:
      return { label: _('No data'), color: 'gray' };
  }
}

function signalCell(value, label, statusColor) {
  let colors = {
    green: '#34c759',
    orange: '#FFA500',
    yellow: '#FFFF00',
    red: '#e74c3c',
    gray: '#7f8c8d'
  };
  let color = colors[statusColor] || '#7f8c8d';
  let textColor = (statusColor === 'green' || statusColor === 'red' || statusColor === 'orange') ? '#ffffff' : '#000000';
  let textShadow = (statusColor === 'yellow')
    ? '2px 2px 5px rgba(128, 128, 128, 0.5)'
    : (textColor === '#ffffff' ? '3px 3px 8px rgba(0, 0, 0, 0.7)' : 'none');

  return E('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;' }, [
    E('span', {
      style: 'background-color:'+color+';color:'+textColor+';padding:3px 10px;border-radius:12px;min-width:80px;width:80px;text-align:center;white-space:nowrap;font-weight:500;text-shadow:'+textShadow+';'
    }, value),
    E('span', { style: 'font-size:12px;font-weight:light;white-space:nowrap;' }, label)
  ]);
}

function createDataConnectionStateElement(stateId, status) {
  let statusInfo = {
    CONNECTED:    { label: _('Connected'),    color: '#34c759', textColor: '#ffffff' },
    DISCONNECTED: { label: _('Disconnected'), color: '#7f8c8d', textColor: '#ffffff' }
  };
  let info = statusInfo[status] || statusInfo.DISCONNECTED;
  let textShadow = '0 1px 2px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.25)';

  return E('div', { style: 'display:flex;font-size:12px;' }, [
    E('span', {
      id: stateId,
      style: 'background-color:'+info.color+';color:'+info.textColor+';padding:2px 5px;border-radius:4px;min-width:92px;max-width:92px;text-align:center;white-space:nowrap;font-weight:500;text-shadow:'+textShadow+';'
    }, info.label)
  ]);
}

function formatDateTime(s) {
  if (s.length == 14) return s.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5:$6");
  if (s.length == 12) return s.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5");
  if (s.length == 8)  return s.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  if (s.length == 6)  return s.replace(/(\d{4})(\d{2})/, "$1-$2");
  return s;
}

function checkOperatorName(t) {
  let w = t.split(' ');
  let f = {};
  for (let i = 0; i < w.length; i++) {
    let wo = w[i].toLowerCase();
    if (!f.hasOwnProperty(wo)) f[wo] = i;
  }
  let u = Object.keys(f).map(function(wo){ return w[f[wo]]; });
  return u.join(' ');
}

async function handleDownloadAction(ev) {
  if (ev !== 'godownload') return;

  let activeTab = document.querySelector('[data-tab].active') || document.querySelector('[data-tab]');
  if (!activeTab) return;

  let tabIndex = String(activeTab.getAttribute('data-tab') || '').replace('tab', '');
  let cellElement = document.getElementById('cell_' + tabIndex);
  let providerElement = document.getElementById('operator_' + tabIndex);
  let providerValue = providerElement ? (providerElement.textContent || '').trim().toLowerCase() : '';

  if (!cellElement) return;

  let cellValue = (cellElement.textContent || '').trim();
  let parts = cellValue.split(/\s+/);
  let hexPart = parts.length > 1 ? parts[1] : '';
  let cellHEXNumeric = hexPart ? hexPart.replace(/[()]/g, '') : '';

  let searchsite = '';
  switch (providerValue) {
    case 't-mobile': searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=1&mode=std'; break;
    case 'orange':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=2&mode=std'; break;
    case 'plus':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=3&mode=std'; break;
    case 'play':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=4&mode=std'; break;
    case 'sferia':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=5&mode=std'; break;
    case 'aero 2':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=8&mode=std'; break;
    default:         searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=-1&mode=std'; break;
  }

  try {
    await fs.exec_direct('/usr/bin/wget', ['-O', '/tmp/bts' + tabIndex + '_file', searchsite]);
    let exists = await fs.stat('/tmp/bts' + tabIndex + '_file');

    if (!exists) {
      ui.addNotification(null, E('p', _('Failed to download bts data file from site.')), 'error');
      poll.start();
      return;
    }

    let mybts = await fs.exec_direct('/usr/share/modemdata/btsearch.sh', [tabIndex]);
    if (!mybts) {
      ui.addNotification(null, E('p', _('Failed to process the downloaded file with btsearch.sh.')), 'error');
      poll.start();
      return;
    }

    let json = JSON.parse(mybts);
    if (!json || !json.mobile || json.mobile.length <= 2) {
      poll.start();
      return;
    }

    if (poll.active()) poll.stop();

    ui.showModal(
      E('span', {}, [
        E('img', {
          'src': L.resource('icons/mybts.svg'),
          'style': 'padding-left: 2px; height: 32px; width: auto; display: inline-block; vertical-align: middle;'
        }),
        ' ',
        _('BTS Information'),
        E('hr')
      ]),
      [
        E('div', { class: 'info-message' }, [
          L.itemlist(E('span'), [
            _('Network'),            json.mobile.length > 1 ? json.mobile : '-',
            _('Location'),           json.location.length > 1 ? json.location : '-',
            _('Cd.'),                json.locationmax.length > 1 ? json.locationmax : '-',
            _('Band'),               json.band.length > 1 ? json.band : '-',
            _('Duplex'),             json.duplex.length > 1 ? json.duplex : '-',
            _('LAC/TAC'),            json.lac_tac.length > 1 ? json.lac_tac : '-',
            _('CID'),                json.cid.length > 1 ? json.cid : '-',
            _('RNC/eNBI'),           json.rnc_enbi.length > 1 ? json.rnc_enbi : '-',
            _('UC-Id/ECID'),         json.uc_id_ecid.length > 1 ? json.uc_id_ecid : '-',
            _('StationID'),          json.stationid.length > 1 ? json.stationid : '-',
            _('Notes Update date'),  json.notes_update_date.length > 1 ? json.notes_update_date : '-'
          ])
        ]),
        E('div', { 'class': 'right' }, [
          E('button', {
            'class': 'btn',
            'click': ui.createHandlerFn(this, function() {
              ui.hideModal();
              if (!poll.active()) poll.start();
            }),
          }, _('Close')),
        ]),
      ]
    );
  } catch (err) {
    ui.addNotification(null, E('p', {}, _('Error: ') + err.message));
    poll.start();
  }
}

function updateTableToValues(ev, modemIndex) {
  let table = document.getElementById('lteTable_' + modemIndex);
  if (!table) return;

  let headerCell = table.querySelector('tr:first-child th:last-child');
  if (!headerCell) return;

  // SNR/SINR
  let hasSnr  = ev && (ev.snr  !== undefined && ev.snr  !== null && ev.snr  !== '');
  let hasSinr = ev && (ev.sinr !== undefined && ev.sinr !== null && ev.sinr !== '');

  // COLUMN MOD
  if (hasSinr) {
    headerCell.textContent = _('SINR');
  } else if (hasSnr) {
    headerCell.textContent = _('SNR');
  } else {
    headerCell.textContent = _('SINR'); // SINR
  }
}

function handleAction(ev) {
  if (ev !== 'useraction') return;

  return uci.load('modemdata').then(function() {
    let bts_web = (uci.get('modemdata', '@modemdata[0]', 'website'));
    let bts_action = (uci.get('modemdata', '@modemdata[0]', 'btsaction'));

    if (bts_web && bts_web.indexOf('btsearch') >= 0) {
      if (bts_action && bts_action.indexOf('open') >= 0) {
        let activeTab = document.querySelector('[data-tab].active') || document.querySelector('[data-tab]');
        if (activeTab) {
          let tabIndex = String(activeTab.getAttribute('data-tab') || '').replace('tab', '');
          let cellElement = document.getElementById('cell_' + tabIndex);
          let providerElement = document.getElementById('operator_' + tabIndex);
          let providerValue = providerElement ? (providerElement.textContent || '').trim().toLowerCase() : '';

          if (cellElement) {
            let cellValue = (cellElement.textContent || '').trim();
            let parts = cellValue.split(/\s+/);
            let hexPart = parts.length > 1 ? parts[1] : '';
            let cellHEXNumeric = hexPart ? hexPart.replace(/[()]/g, '') : '';

            let searchsite = '';
            switch (providerValue) {
              case 't-mobile': searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=1&mode=std'; break;
              case 'orange':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=2&mode=std'; break;
              case 'plus':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=3&mode=std'; break;
              case 'play':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=4&mode=std'; break;
              case 'sferia':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=5&mode=std'; break;
              case 'aero 2':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=8&mode=std'; break;
              default:         searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=-1&mode=std'; break;
            }
            window.open(searchsite, '_blank');
          }
        }
      } else {
        handleDownloadAction('godownload');
      }
    }

    if (bts_web && bts_web.indexOf('lteitaly') >= 0) {
      let activeTab2 = document.querySelector('[data-tab].active') || document.querySelector('[data-tab]');
      if (activeTab2) {
        let tabIndex2 = String(activeTab2.getAttribute('data-tab') || '').replace('tab', '');
        let cellElement2 = document.getElementById('cell_' + tabIndex2);
        let mncElement = document.getElementById('mnc_' + tabIndex2);
        let mccElement = document.getElementById('mcc_' + tabIndex2);

        let cellValue2 = cellElement2 ? (cellElement2.textContent || '').trim() : '';
        let mncValue = mncElement ? (mncElement.textContent || '').trim() : '';
        let mccValue = mccElement ? (mccElement.textContent || '').trim() : '';
        let cellNumeric2 = parseInt((cellValue2.split(/\s+/)[0] || '0'), 10);

        let zzmnc = mncValue || '';
        let first = zzmnc.slice(0, 1);
        let second = zzmnc.slice(1, 2);
        let zzcid = Math.round(cellNumeric2 / 256);
        let cutmnc = zzmnc;

        if (zzmnc.length == 3) {
          if (first.indexOf('0') >= 0) cutmnc = zzmnc.slice(1, 3);
          if (first.indexOf('0') >= 0 && second.indexOf('0') >= 0) cutmnc = zzmnc.slice(2, 3);
        } else if (zzmnc.length == 2) {
          first = zzmnc.slice(0, 1);
          if (first.indexOf('0') >= 0) cutmnc = zzmnc.slice(1, 2);
          else cutmnc = zzmnc;
        } else if (zzmnc.length < 2 || (first.indexOf('0') < 0 && second.indexOf('0') < 0)) {
          cutmnc = zzmnc;
        }

        window.open('https://lteitaly.it/internal/map.php#bts=' + mccValue + cutmnc + '.' + zzcid);
      }
    }
  });
}

function CreateModemMultiverse(modemTabs, sectionsxt) {
  return Promise.all(modemTabs.map(function(modem) {
    return (function() {
      return (function() {
        if (modem.modemdata === 'serial' || modem.modemdata === 'ecm')
          return L.resolveDefault(fs.exec_direct('/usr/bin/md_serial_ecm', [modem.comm_port, modem.network]));
        else if (modem.modemdata === 'uqmi')
          return L.resolveDefault(fs.exec_direct('/usr/bin/md_uqmi', [modem.comm_port, modem.network, modem.forced_plmn_op, modem.mbim_op]));
        else if (modem.modemdata === 'mm') {
          return L.resolveDefault(fs.exec_direct('/usr/bin/md_modemmanager', [modem.comm_port, modem.network, modem.forced_plmn_op]));
        }
        return Promise.resolve('');
      })().then(function(res) {
        if (!res) return;

        let jsonraw = JSON.parse(res);
        let json = Object.values(jsonraw);
        // Guard na nieoczekiwanš strukturę
        if (!json || json.length < 3 || !json[0] || !json[1] || !json[2]) return;

        let rowsWcdma = [];
        let rowsLte = [];

        // GET MODEMS TABLE
        let wcdmaTable = document.getElementById(modem.wcdmaTableId);
        let lteTable = document.getElementById(modem.lteTableId);

        // BANDS
        let modeRaw = json[2].mode || '';
        let modeLower = modeRaw.toLowerCase();
        let bands = (json[2].addon || []).filter(function(item) {
          return item.key === 'Primary band' || /^\(S\d+\) band$/.test(item.key);
        });

        // FAKE BAND FOR MM
        if (bands.length === 0) {
          bands.push({ key: 'Primary band', value: _('(no data)') });
        }

        // WCDMA (NO LTE/5G & BANDS)
        if (!modeLower.match(/lte|5g/) && bands.length === 0) {
          let bs = document.getElementById(modem.bandshowId);
          if (bs) bs.style.display = 'block';
          if (lteTable) lteTable.style.display = 'none';
          if (wcdmaTable) wcdmaTable.style.display = 'table';

          let uarfcn = (json[2].addon.find(function(i){ return i.key==='UARFCN'; })||{}).value || '-';
          let rssi  = (json[2].addon.find(function(i){ return i.key==='RSSI'; })||{}).value  || '-';
          let rscp  = (json[2].addon.find(function(i){ return i.key==='RSCP'; })||{}).value  || '-';
          let ecio  = (json[2].addon.find(function(i){ return i.key==='ECIO'; })||{}).value  || '-';

          rowsWcdma.push([
            modeRaw || '-',
            uarfcn,
            !isNaN(parseInt(rssi,10)) ? signalCell(rssi, getSignalLabel(rssi,'RSSI_wcdma').label, getSignalLabel(rssi,'RSSI_wcdma').color) : E('div', {}, _('')),
            !isNaN(parseInt(rscp,10)) ? signalCell(rscp, getSignalLabel(rscp,'RSCP').label, getSignalLabel(rscp,'RSCP').color) : E('div', {}, _('')),
            !isNaN(parseInt(ecio,10)) ? signalCell(ecio, getSignalLabel(ecio,'ECIO').label, getSignalLabel(ecio,'ECIO').color) : E('div', {}, _(''))
          ]);

          if (wcdmaTable) cbi_update_table(wcdmaTable, rowsWcdma);
        } else {
          // LTE/5G
          let bs2 = document.getElementById(modem.bandshowId);
          if (bs2) bs2.style.display = 'block';
          if (lteTable) lteTable.style.display = 'table';
          if (wcdmaTable) wcdmaTable.style.display = 'none';

          let getFirstValueWithUnit = function(key) {
            let raw = (json[2].addon.find(function(i){ return i.key === key; })||{}).value || '-';
            let parts = raw.split('/');
            let first = parts[0] ? parts[0].trim() : '-';
            let second = parts[1] ? parts[1].trim() : '';
            let unitMatch = second && second.match(/(dBm|dB)$/i);
            return unitMatch ? (first + ' ' + unitMatch[1]) : first;
          };

          for (let i = 0; i < bands.length; i++) {
            let bandKey = bands[i].key;
            let bandLabel = '';

            if (bandKey === 'Primary band') bandLabel = 'PCC';
            else {
              let bandIndexM = bandKey.match(/\d+/);
              if (bandIndexM) bandLabel = 'SCC' + bandIndexM[0];
            }

            let bandValue = (bands[i].value.split(' @')[0]) || '-';
            let bandwidthValue = (bands[i].value.split(' @')[1] || '').trim() || '-';

            let row = [ bandLabel + ' ' + bandValue, bandwidthValue ];

            let bandIndexM2 = bandKey.match(/\d+/);
            if (bandIndexM2) {
              // SCC
              let n = bandIndexM2[0];
              let getVal = function(k){
                let o = json[2].addon.find(function(x){ return x.key === k; });
                return o ? o.value : '-';
              };

              let sinr = getVal('(S' + n + ') SINR');
              let snr  = getVal('(S' + n + ') SNR');
              let signalType = sinr ? 'SINR' : (snr ? 'SNR' : null);
              let signalValue = sinr || snr || '-';
              let sl = getSignalLabel(signalValue, signalType);
              let signalLabel = sl.label;
              let signalColor = sl.color;
              let formattedSignalValue = !isNaN(parseFloat(signalValue))
                ? (String(signalValue).indexOf('dB') >= 0 ? signalValue : (signalValue + ' dB'))
                : '-';

              row.push(
                getVal('(S' + n + ') PCI'),
                getVal('(S' + n + ') EARFCN'),
                !isNaN(parseInt(getVal('(S' + n + ') RSSI'),10)) ? signalCell(getVal('(S' + n + ') RSSI'), getSignalLabel(getVal('(S' + n + ') RSSI'),'RSSI').label, getSignalLabel(getVal('(S' + n + ') RSSI'),'RSSI').color) : E('div', {}, _('')),
                !isNaN(parseInt(getVal('(S' + n + ') RSRP'),10)) ? signalCell(getVal('(S' + n + ') RSRP'), getSignalLabel(getVal('(S' + n + ') RSRP'),'RSRP').label, getSignalLabel(getVal('(S' + n + ') RSRP'),'RSRP').color) : E('div', {}, _('')),
                !isNaN(parseInt(getVal('(S' + n + ') RSRQ'),10)) ? signalCell(getVal('(S' + n + ') RSRQ'), getSignalLabel(getVal('(S' + n + ') RSRQ'),'RSRQ').label, getSignalLabel(getVal('(S' + n + ') RSRQ'),'RSRQ').color) : E('div', {}, _('')),
                formattedSignalValue !== '-' ? signalCell(formattedSignalValue, signalLabel, signalColor) : E('div', {}, _(''))
              );

              rowsLte.push(row);
            } else {
              // PCC
              let pci = (json[2].addon.find(function(i){ return i.key==='PCI'; })||{}).value || '-';

              let earfcn = (json[2].addon.find(function(i){ return i.key==='EARFCN'; })||{}).value;
              if (!earfcn) {
                let earfcnDl = (json[2].addon.find(function(i){ return i.key==='EARFCN DL'; })||{}).value || '-';
                let earfcnUl = (json[2].addon.find(function(i){ return i.key==='EARFCN UL'; })||{}).value || '-';
                earfcn = 'DL: ' + earfcnDl + ' UL: ' + earfcnUl;
              }

              let sinr0 = (json[2].addon.find(function(i){ return i.key==='SINR'; })||{}).value;
              let snr0  = (json[2].addon.find(function(i){ return i.key==='SNR'; })||{}).value;
              let signalType0 = sinr0 ? 'SINR' : (snr0 ? 'SNR' : null);
              let signalValue0 = sinr0 || snr0 || '-';
              let sl0 = getSignalLabel(signalValue0, signalType0);
              let signalLabel0 = sl0.label;
              let signalColor0 = sl0.color;
              let formattedSignalValue0 = !isNaN(parseFloat(signalValue0))
                ? (String(signalValue0).indexOf('dB') >= 0 ? signalValue0 : (signalValue0 + ' dB'))
                : '-';

              row.push(
                pci,
                earfcn,
                !isNaN(parseFloat(getFirstValueWithUnit('RSSI'))) ? signalCell(getFirstValueWithUnit('RSSI'), getSignalLabel(getFirstValueWithUnit('RSSI'),'RSSI').label, getSignalLabel(getFirstValueWithUnit('RSSI'),'RSSI').color) : E('div', {}, _('')),
                !isNaN(parseFloat(getFirstValueWithUnit('RSRP'))) ? signalCell(getFirstValueWithUnit('RSRP'), getSignalLabel(getFirstValueWithUnit('RSRP'),'RSRP').label, getSignalLabel(getFirstValueWithUnit('RSRP'),'RSRP').color) : E('div', {}, _('')),
                !isNaN(parseInt((json[2].addon.find(function(i){ return i.key==='RSRQ'; })||{}).value,10)) ? signalCell((json[2].addon.find(function(i){ return i.key==='RSRQ'; })||{}).value, getSignalLabel((json[2].addon.find(function(i){ return i.key==='RSRQ'; })||{}).value,'RSRQ').label, getSignalLabel((json[2].addon.find(function(i){ return i.key==='RSRQ'; })||{}).value,'RSRQ').color) : E('div', {}, _('')),
                formattedSignalValue0 !== '-' ? signalCell(formattedSignalValue0, signalLabel0, signalColor0) : E('div', {}, _(''))
              );

              rowsLte.push(row);
            }
          }

          if (lteTable) cbi_update_table(lteTable, rowsLte);

          let tsnr = {
            sinr: (json[2].addon.find(function(i){ return i.key==='SINR'; }) || {}).value,
            snr:  (json[2].addon.find(function(i){ return i.key==='SNR'; })  || {}).value
          };
          updateTableToValues(tsnr, modem.index); // modem.index
        }

        // MOBILE SVG
        let p = json[2].signal;
        let icon;
        switch (true) {
          case (p <= 0): icon = L.resource('icons/mobile-signal-000-000.svg'); break;
          case (p < 20): icon = L.resource('icons/mobile-signal-000-020.svg'); break;
          case (p < 40): icon = L.resource('icons/mobile-signal-020-040.svg'); break;
          case (p < 60): icon = L.resource('icons/mobile-signal-040-060.svg'); break;
          case (p < 80): icon = L.resource('icons/mobile-signal-060-080.svg'); break;
          default:       icon = L.resource('icons/mobile-signal-080-100.svg'); break;
        }

        // Signal
        let signalView = document.getElementById(modem.signalId);
        if (signalView) {
          signalView.innerHTML = '';
          if (p === 0) {
            if (lteTable) lteTable.style.display = 'none';
            if (wcdmaTable) wcdmaTable.style.display = 'none';
            let bs3 = document.getElementById(modem.bandshowId); if (bs3) bs3.style.display = 'none';
          }
          let title = _('Signal strength') + ': ' + p + '%';
          signalView.appendChild(
            E('div', { 'class': 'ifacebadge', 'style': 'width:92px;', 'title': title }, [
              E('img', { 'src': icon, 'style': 'padding-left:2px;height:32px;width:auto;display:inline-block;' }),
              E('strong', {}, p > 0 ? (p + '%') : '')
            ])
          );
        }

        // Connection state
        let stateView = document.getElementById(modem.stateId);
        if (stateView) {
          let status = json[1].status;
          let el = createDataConnectionStateElement('dataStatus', status);
          stateView.innerHTML = '';
          stateView.appendChild(el);
        }

        // Connection statistics
        let connstView = document.getElementById(modem.connstId);
        if (connstView) {
          if (json[1].conn_time_sec < 1) {
            connstView.innerHTML = '';
            if (lteTable) lteTable.style.display = 'none';
            if (wcdmaTable) wcdmaTable.style.display = 'none';
            let bs4 = document.getElementById(modem.bandshowId); if (bs4) bs4.style.display = 'none';
            connstView.appendChild(E('div', {}, [ E('em', { 'class': 'spinning' }, _('Waiting for data...')) ]));
          } else {
            connstView.innerHTML = '';
            let title2 = _('Time') + ': ' + formatDuration(json[1].conn_time_sec);
            connstView.appendChild(
              E('div', { 'class': 'ifacebadge', 'title': title2 }, [
                E('img', { 'src': L.resource('icons/ctime_new.svg'), 'style': 'height:16px;width:auto;display:inline-block;vertical-align:middle;' }),
                E('normal', { 'style': 'margin-left:.5em;display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:85%;vertical-align:middle;' }, [ formatDuration(json[1].conn_time_sec) || '-' ])
              ])
            );
          }
        }

        let rxView = document.getElementById(modem.rxId);
        if (rxView) rxView.textContent = json[1].rx.length > 1 ? json[1].rx : '0 B';

        let txView = document.getElementById(modem.txId);
        if (txView) txView.textContent = json[1].tx.length > 1 ? json[1].tx : '0 B';

        // Maskowanie
        let hide_list = Array.isArray(sectionsxt[0].hide_data) ? sectionsxt[0].hide_data : [];
        let hidedata = document.getElementById('hide-data') ? document.getElementById('hide-data').checked : false;

        // Operator
        let operatorView = document.getElementById(modem.operatorId);
        if (operatorView) {
          let opName = json[2].operator_name.length > 1 ? checkOperatorName(json[2].operator_name) : '-';
          operatorView.textContent = (hidedata && hide_list.indexOf(_('Operator')) >= 0) ? opName.replace(/./g, '#') : opName;
        }

        // SIM status
        let simView = document.getElementById(modem.simId);
        if (simView) {
          let reg = json[2].registration;
          let simStatusValue = '-';
          switch (reg) {
            case '0': simStatusValue = _('Not registered'); break;
            case '1': simStatusValue = _('Registered'); break;
            case '2': simStatusValue = _('Searching..'); break;
            case '3': simStatusValue = _('Registering denied'); break;
            case '5': simStatusValue = _('Registered (roaming)'); break;
            case '6': simStatusValue = _('Registered, only SMS'); break;
            case '7': simStatusValue = _('Registered (roaming), only SMS'); break;
            default:  simStatusValue = '-';
          }
          simView.textContent = simStatusValue;
          simView.title = simStatusValue;
        }

        // SIM slot
        let slotView = document.getElementById(modem.slotId);
        if (slotView) {
          slotView.innerHTML = '';
          let slotObj = (json[2].addon || []).find(function(i){ return i.key==='Slot'; });
          let slot = slotObj ? ('SIM ' + slotObj.value) : _('No data');
          if (slot && slot !== _('No data') && parseInt(slotObj.value, 10) >= 1) {
            let slotDivElement = document.getElementById(modem.slotDivId);
            if (slotDivElement) slotDivElement.style.display = 'flex';
            slotView.appendChild(
              E('div', { 'class': 'ifacebadge', 'title': _('Slot in use') + ': ' + slot }, [
                E('img', { 'src': L.resource('icons/sim_new.svg'), 'style': 'height:32px;width:auto;display:inline-block;margin:0 auto;' }),
                E('normal', { 'style': 'margin-left:.5em;' }, [ slot ])
              ])
            );
          }
        }

        // ICCID
        let iccidView = document.getElementById(modem.iccidId);
        if (iccidView) {
          iccidView.innerHTML = (hidedata && hide_list.indexOf('ICCID') >= 0) ? (json[0].iccid || '').replace(/./g, '#') : (json[0].iccid || '');
        }

        // IMEI
        let imeiView = document.getElementById(modem.imeiId);
        if (imeiView) {
          imeiView.innerHTML = (hidedata && hide_list.indexOf('IMEI') >= 0) ? (json[0].imei || '').replace(/./g, '#') : (json[0].imei || '');
        }

        // IMSI
        let imsiView = document.getElementById(modem.imsiId);
        if (imsiView) {
          imsiView.innerHTML = (hidedata && hide_list.indexOf('IMSI') >= 0) ? (json[0].imsi || '').replace(/./g, '#') : (json[0].imsi || '');
        }

        // Country
        let countryView = document.getElementById(modem.countryId);
        if (countryView) {
          let countryTxt = (json[2].country || '').replace('Poland', _('Poland'));
          countryView.style.display = (countryTxt && countryTxt.length > 2) ? '' : 'none';
          countryView.innerHTML = (hidedata && hide_list.indexOf(_('Country')) >= 0) ? countryTxt.replace(/./g, '#') : countryTxt;
        }

        // Modem type
        let modemtypeView = document.getElementById(modem.modemtypeId);
        if (modemtypeView) {
          modemtypeView.textContent = (json[0].vendor || '-') + ' ' + (json[0].product || '-');
          modemtypeView.title = modemtypeView.textContent;
        }

        // FW
        let firmwareView = document.getElementById(modem.firmwareId);
        if (firmwareView) {
          firmwareView.textContent = json[0].revision || '-';
          firmwareView.title = firmwareView.textContent;
        }

        // Temperature
        let tempView = document.getElementById(modem.tempId);
        if (tempView) {
          let temperatureObj = (json[2].addon || []).find(function(i){ return i.key==='Temperature'; });
          let temperature = temperatureObj ? temperatureObj.value : _('No data');
          // poprawny znak stopnia
          temperature = temperature.replace('&deg;', '°');
          if (temperature && temperature !== _('No data') && temperature.length > 2) {
            let tempDivElement = document.getElementById(modem.tempDivId);
            if (tempDivElement) tempDivElement.style.display = 'flex';
            tempView.innerHTML = '';
            tempView.appendChild(
              E('div', { 'class': 'ifacebadge', 'title': _('Chip Temperature') + ': ' + temperature }, [
                E('img', { 'src': L.resource('icons/termometr.svg'), 'style': 'padding-left:2px;height:32px;width:auto;display:inline-block;' }),
                E('normal', { 'style': 'margin-left:.1em;font-size:12px' }, [ temperature || '-' ])
              ])
            );
          }
        }

        // Cell ID
        let cellView = document.getElementById(modem.cellId);
        if (cellView) {
          let celldata = (json[2].cid_dec + ' (' + json[2].cid_hex + ')');
          if (hidedata && hide_list.indexOf(_('Cell ID')) >= 0) celldata = celldata.replace(/./g, '#');
          if (parseInt(json[2].cid_dec || '0', 10) < 1) cellView.innerHTML = '-';
          else {
            cellView.textContent = celldata;
            cellView.title = celldata;
          }
        }

        // LAC
        let lacView = document.getElementById(modem.lacId);
        if (lacView) {
          if (hidedata && hide_list.indexOf('LAC') >= 0) {
            lacView.innerHTML = (json[2].lac_dec || '').replace(/./g, '#') + ' (' + (json[2].lac_hex || '').replace(/./g, '#') + ')';
          } else {
            if (!json[2].lac_dec || !json[2].lac_hex || json[2].lac_dec === '0' || json[2].lac_hex === '0')
              lacView.innerHTML = '-';
            else
              lacView.innerHTML = json[2].lac_dec + ' (' + json[2].lac_hex + ')';
          }
        }

        // TAC
        let tacView = document.getElementById(modem.tacId);
        if (tacView) {
          let tacObj = (json[2].addon || []).find(function(i){ return i.key==='TAC'; });
          let tac = tacObj ? tacObj.value : _('-');
          tacView.innerHTML = (hidedata && hide_list.indexOf('TAC') >= 0) ? tac.replace(/./g, '#') : tac;
        }

        // MCC
        let mccView = document.getElementById(modem.mccId);
        if (mccView) {
          mccView.innerHTML = (hidedata && hide_list.indexOf('MCC') >= 0) ? (json[2].operator_mcc || '').replace(/./g, '#') : (json[2].operator_mcc || '');
        }

        // MNC
        let mncView = document.getElementById(modem.mncId);
        if (mncView) {
          mncView.innerHTML = (hidedata && hide_list.indexOf('MNC') >= 0) ? (json[2].operator_mnc || '').replace(/./g, '#') : (json[2].operator_mnc || '');
        }

        // Mode
        let modeView = document.getElementById(modem.modeId);
        if (modeView) {
          if ((json[2].mode || '').length <= 1) {
            modeView.textContent = '-';
            if (lteTable) lteTable.style.display = 'none';
            if (wcdmaTable) wcdmaTable.style.display = 'none';
            let bs5 = document.getElementById(modem.bandshowId); if (bs5) bs5.style.display = 'none';
          } else {
            let modeRaw2 = json[2].mode || '';
            let modeUp = modeRaw2.toUpperCase();
            let modeDisplay;

            if (modeUp.indexOf('LTE') >= 0 || modeUp.indexOf('5G') >= 0) {
              let tech = '';
              if (modeUp.indexOf('LTE') >= 0) tech = modeRaw2.split(' ')[0];
              if (modeUp.indexOf('5G') >= 0) tech = modeRaw2.split(' ')[0] + (modeRaw2.split(' ')[1] ? (' ' + modeRaw2.split(' ')[1]) : '');
              let count = (modeRaw2.match(/\//g) || []).length + 1;
              modeDisplay = (count > 1) ? (tech + ' (' + count + 'CA)') : tech;
            } else {
              modeDisplay = modeRaw2.split(' ')[0];
            }

            modeDisplay = modeDisplay.replace('LTE_A', 'LTE-A');
            modeView.textContent = modeDisplay;
          }
        }
      });
    })().catch(function(e) {
      console.error('JSON parsing error', modem.comm_port, e);
    });
  })).then(function() {
    return Promise.resolve();
  });
}

return view.extend({

  load: function() {
    return Promise.all([
      uci.load('defmodems'),
      uci.load('modemdata')
    ]);
  },

  render: function (data) {
    let sections   = uci.sections('defmodems', 'defmodems') || [];
    let sectionsxt = uci.sections('modemdata', 'modemdata') || [];

    loadUCInterval();

    let info = _('For more information about the modemdata package, please visit: %shttps://github.com/obsy/modemdata%s.')
      .format('<a href="https://github.com/obsy/modemdata" target="_blank">', '</a>');

    if (!Array.isArray(sections) || sections.length === 0) {

      let modemsModal = baseclass.extend({
        __init__: function() {
          this.title = _('No Modems Detected...');
          this.description = _('Oops.. there are no modems in settings. You will be redirected to a tab where you can define the installed modem(s).');
          this.countdown = 10;
          this.timer = null;
        },

        startCountdown: function() {
          let self = this;
          let countdownLabel = document.getElementById('countdownLabel');
          this.timer = setInterval(function() {
            self.countdown--;
            if (self.countdown > 0) {
              countdownLabel.textContent = _('Redirecting in') +' '+ self.countdown +' '+ _('seconds...');
            } else {
              clearInterval(self.timer);
              countdownLabel.textContent = _('Redirecting...');

              let pkg = {
                get modemdefURI() {
                  return 'admin/modem/modemdata/modemdefine';
                }
              };
              window.location.href = L.url(pkg.modemdefURI);
            }
          }, 1000);
        },

        render: function() {
          ui.showModal(this.title, [
            E('div', { class: 'info-message' }, [
              E('p', {}, this.description),
              E('label', { id: 'countdownLabel' }, _('Redirecting in') +' '+ this.countdown +' '+ _('seconds...'))
            ]),
          ], 'cbi-modal');

          this.startCountdown();
        }
      });

      let modemDialog = new modemsModal();
      modemDialog.render();

      return E([
        E('h2', { 'class': 'fade-in' }, _('Modemdata')),
        E('div', { 'class': 'cbi-section-descr fade-in' },
          _('Package allows the user to view the data read from the modem, to see the parameters of the connection to the mobile network.') + '<br />' + info)
      ]);
    }

    // SETTINGZ
    let globalToolbar = E('div', {
      'class': 'right',
      'style': 'width:100%; margin-bottom:8px; display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap;'
    }, [
      // L
      E('div', { 'style': 'display:flex; flex-direction:column; align-items:flex-start; gap:.5rem; min-width:320px;' }, [
        E('div', { 'style': 'display:flex; align-items:center; gap:.75rem; flex-wrap:wrap;' }, [
          E('label', { 'for': 'selectInterval', 'style': 'text-align:left;' }, _('Auto update every:')),
          E('select', { 'id': 'selectInterval', 'change': clickToSelectInterval }, [
            E('option', { value: '-1' }, _('Disabled')),
            E('option', { value: '2' }, _('2 seconds')),
            E('option', { value: '5' }, _('5 seconds')),
            E('option', { value: '10' }, _('10 seconds')),
            E('option', { value: '30' }, _('30 seconds')),
            E('option', { value: '45' }, _('45 seconds')),
            E('option', { value: '60' }, _('60 seconds'))
          ])
        ]),

        E('label', {
          'id': 'countdown-label',
          'style': 'font-size:.9em; opacity:.85; min-height:1.2em; margin-top:.25rem; text-align:left;'
        },
          E('em', { 'class': 'spinning' }, _('Please wait... data collection is in progress.'))
        )
      ]),

      // R
      E('div', { 'style': 'display:flex; align-items:center; gap:1rem; margin-left:auto; flex-wrap:wrap;' }, [
        E('label', { 'class': 'cbi-checkbox', 'style': 'user-select:none;' }, [
          E('input', {
            'id': 'hide-data',
            'type': 'checkbox',
            'name': 'showhistory',
            'data-tooltip': _('Check this option if you need to hide selected data')
          }),
          ' ',
          E('label', { 'for': 'hide-data' }),
          ' ',
          _('Hide data.')
        ]),
        E('span', {}, _('Search BTS using Cell ID')),
        E('button', {
          'class': 'cbi-button cbi-button-action important',
          'id': 'btsSearch',
          'click': ui.createHandlerFn(this, function () { return handleAction('useraction'); })
        }, _('Search'))
      ])
    ]);

    let tabsContainer = E('div', { 'class': 'cbi-section-node cbi-section-node-tabbed' });
    let modemTabs = [];

    let wcdmaTableTitles = [
      _('Name'),
      _('UARFCN'),
      _('RSSI'),
      _('RSCP'),
      _('EC/IO'),
    ];

    let lteTableTitles = [
      _('Band'),
      _('Bandwidth'),
      _('Physical cell ID'),
      _('EARFCN'),
      _('RSSI'),
      _('RSRP'),
      _('RSRQ'),
      _('SINR'),
    ];

    // TABS
    for (let i = 0; i < sections.length; i++) {
      let modem = sections[i];
      let rmethod = modem.modemdata || '-';
      let fplmn   = modem.forced_plmn || '-';
      let rmbim   = modem.onproxy || '-';
      let modemName = modem.modem || '-';
      let desc    = modem.user_desc || '-';
      let net     = modem.network || '-';
      let mport   = modem.comm_port || '-';
      let tabTitle = modemName + (desc.length >= 2 ? (' (' + desc + ')') : '');

      // Data_i
      let signalId     = 'signal_' + i;
      let connstId     = 'connst_' + i;
      let stateId      = 'state_' + i;
      let operatorId   = 'operator_' + i;
      let countryId    = 'country_' + i;
      let simId        = 'sim_' + i;
      let rxId         = 'rx_' + i;
      let txId         = 'tx_' + i;
      let slotId       = 'slot_' + i;
      let slotDivId    = 'slotDiv_' + i;
      let tempDivId    = 'tempDiv_' + i;
      let iccidId      = 'iccid_' + i;
      let imeiId       = 'imei_' + i;
      let imsiId       = 'imsi_' + i;
      let modemtypeId  = 'modemtype_' + i;
      let firmwareId   = 'firmware_' + i;
      let tempId       = 'temp_' + i;
      let cellId       = 'cell_' + i;
      let lacId        = 'lac_' + i;
      let tacId        = 'tac_' + i;
      let mccId        = 'mcc_' + i;
      let mncId        = 'mnc_' + i;
      let modeId       = 'mode_' + i;
      let bandshowId   = 'bandshow_' + i;
      let wcdmaTableId = 'wcdmaTable_' + i;
      let lteTableId   = 'lteTable_' + i;

      // WCDMA & LTE TABLE
        let wcdmaTable = E('table', {
          'class': 'table',
          'id': wcdmaTableId,
          'style': 'border:1px solid var(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%; display:none; font-size:12px;'
        },
          E('tr', { 'class': 'tr table-titles' }, [
            E('th', { 'class': 'th left', 'style': 'min-width:80px; width:80px;'  }, wcdmaTableTitles[0]), // Name
            E('th', { 'class': 'th left', 'style': 'min-width:80px; width:80px;;'  }, wcdmaTableTitles[1]), // UARFCN
            E('th', { 'class': 'th left', 'style': 'min-width:100px; width:100px;' }, wcdmaTableTitles[2]), // RSSI
            E('th', { 'class': 'th left', 'style': 'min-width:100px; width:100px;' }, wcdmaTableTitles[3]), // RSCP
            E('th', { 'class': 'th left', 'style': 'min-width:100px; width:100px;' }, wcdmaTableTitles[4])  // EcIo
          ])
        );

        let lteTable = E('table', {
          'class': 'table',
          'id': lteTableId,
          'style': 'border:1px solid var(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%; display:none; font-size:12px;'
        },
          E('tr', { 'class': 'tr table-titles' }, [
            E('th', { 'class': 'th left', 'style': 'min-width:110px; width:110px;' }, lteTableTitles[0]), // Band
            E('th', { 'class': 'th left', 'style': 'min-width:80px;  width:80px;'  }, lteTableTitles[1]), // Bandwidth
            E('th', { 'class': 'th left', 'style': 'min-width:80px;  width:80px;'  }, lteTableTitles[2]), // PCI
            E('th', { 'class': 'th left', 'style': 'min-width:55px;  width:55px;'  }, lteTableTitles[3]), // EARFCN
            E('th', { 'class': 'th left', 'style': 'min-width:100px;  width:100px;'  }, lteTableTitles[4]), // RSSI
            E('th', { 'class': 'th left', 'style': 'min-width:100px;  width:100px;'  }, lteTableTitles[5]), // RSRP
            E('th', { 'class': 'th left', 'style': 'min-width:100px;  width:100px;'  }, lteTableTitles[6]), // RSRQ
            E('th', { 'class': 'th left', 'style': 'min-width:100px;  width:100px;'  }, lteTableTitles[7])  // SINR/SNR
          ])
        );

      modemTabs.push({
        index: i,
        network: net,
        comm_port: mport,
        forced_plmn_op: fplmn,
        mbim_op: rmbim,
        modemdata: rmethod,
        signalId: signalId,
        connstId: connstId,
        operatorId: operatorId,
        countryId: countryId,
        simId: simId,
        rxId: rxId,
        txId: txId,
        slotId: slotId,
        slotDivId: slotDivId,
        tempDivId: tempDivId,
        iccidId: iccidId,
        imeiId: imeiId,
        imsiId: imsiId,
        modemtypeId: modemtypeId,
        firmwareId: firmwareId,
        tempId: tempId,
        cellId: cellId,
        lacId: lacId,
        tacId: tacId,
        mccId: mccId,
        mncId: mncId,
        stateId: stateId,
        modeId: modeId,
        bandshowId: bandshowId,
        wcdmaTableId: wcdmaTableId,
        lteTableId: lteTableId
      });

      let modemTab = E('div', {
        'data-tab': 'tab' + i,
        'data-tab-title': tabTitle
      }, [

        E('h4', {}, [ _('General Information') ]),

        E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));margin-bottom:1em;gap:1em' }, [

          // Connection
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head', 'style': 'font-weight:bold;background:#f8f8f8;padding:8px' }, [ _('Connection') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px' }, [
                E('span', {}, _('Signal') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': signalId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px' }, [
                E('span', {}, _('Connection state') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': stateId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Operator') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': operatorId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Country') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': countryId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Technology') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': modeId }, [ '-' ])
              ]),
              E('div', { 'style': 'text-align:left;font-size:11px;border-top:1px solid var(--border-color-medium);padding-top:8px' }, [
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('Connection time') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': connstId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:2px' }, [
                  E('span', '\u25b2\u202f' + _('Sent') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': txId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between' }, [
                  E('span', '\u25bc\u202f' + _('Received') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': rxId }, [ '-' ])
                ])
              ])
            ])
          ]),

          // SIM Card
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head', 'style': 'font-weight:bold;background:#f8f8f8;padding:8px' }, [ _('SIM Card') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'id': 'slotDiv_' + i, 'style': 'display:none;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Slot in use') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': slotId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('SIM status') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:75%; display:inline-block; cursor:pointer;',
                  'id': simId, 'title': '-'
                }, [ '-' ])
              ]),
              E('div', { 'style': 'text-align:left;font-size:11px;border-top:1px solid var(--border-color-medium);padding-top:8px' }, [
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('IMSI') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': imsiId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('ICCID') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': iccidId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('Modem IMEI') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': imeiId }, [ '-' ])
                ])
              ])
            ])
          ]),

          // Modem Info
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head', 'style': 'font-weight:bold;background:#f8f8f8;padding:8px' }, [ _('Modem Information') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Modem type') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%; display:inline-block; cursor:pointer;',
                  'id': modemtypeId, 'title': '-'
                }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Revision / FW') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%; display:inline-block; cursor:pointer;',
                  'id': firmwareId, 'title': '-'
                }, [ '-' ])
              ]),
              E('div', { 'id': 'tempDiv_' + i, 'style': 'display:none;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Chip Temperature') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': tempId }, [ '-' ])
              ])
            ])
          ]),

          // Cell Info
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head', 'style': 'font-weight:bold;background:#f8f8f8;padding:8px' }, [ _('Cell Information') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Cell ID') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:40%; display:inline-block; cursor:pointer;',
                  'id': cellId, 'title': '-'
                }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('TAC') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': tacId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('LAC') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': lacId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Mobile Country Code') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': mccId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Mobile Network Code') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': mncId }, [ '-' ])
              ])
            ])
          ])
        ]),

        E('h4', { id: bandshowId, style: 'display: none;' }, [ _('Bands') ]),
        wcdmaTable,
        lteTable
      ]);

      tabsContainer.append(modemTab);
    }

    setTimeout(function() {
      refresh.labelEl = document.getElementById('countdown-label');
      refresh.selectEl = document.getElementById('selectInterval');
      if (refresh.selectEl) refresh.selectEl.value = String(refresh.interval);
      if (!poll.active() || refresh.interval < 0) setUpdateMessage(refresh.labelEl, -1);
    }, 0);

    document.addEventListener('poll-start', function() {
      if (refresh.selectEl) refresh.selectEl.value = String(refresh.interval);
    });

    document.addEventListener('poll-stop', function() {
      if (refresh.selectEl) refresh.selectEl.value = '-1';
      setUpdateMessage(refresh.labelEl, -1);
    });

    // Poll 1 sec
    poll.add(function() {
      return updateDataTick(function() {
        return CreateModemMultiverse(modemTabs, sectionsxt);
      });
    }, 1);

    // TABS
    setTimeout(function() { ui.tabs.initTabGroup(tabsContainer.children); }, 0);

    return E([
      E('h2', { 'class': 'fade-in' }, _('Modemdata')),
      E('div', { 'class': 'cbi-section-descr fade-in' },
        _('Package allows the user to view the data read from the modem, to see the parameters of the connection to the mobile network.') + '<br />' + info),
      E('hr'),
      globalToolbar,
      tabsContainer
    ]);
  },

  handleSaveApply: null,
  handleSave     : null,
  handleReset    : null
});
