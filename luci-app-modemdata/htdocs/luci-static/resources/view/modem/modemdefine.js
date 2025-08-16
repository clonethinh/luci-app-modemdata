'use strict';
'require baseclass';
'require form';
'require fs';
'require view';
'require uci';
'require ui';
'require tools.widgets as widgets';

/*
  Copyright 2025 Rafał Wabik - IceG - From eko.one.pl forum

  MIT License
*/

function usrdesc(section_id) {
  return E('span', (uci.get('defmodems', section_id, 'user_desc') || ''));
}

function getmodem(section_id) {
  return E('span', (uci.get('defmodems', section_id, 'modem') || ''));
}

function getmodemdata(section_id) {
  return E('span', '<code>' + (uci.get('defmodems', section_id, 'comm_port') + '</code>' || '<code>' + '' + '</code>'));
}

return view.extend({
  modemPath: '/etc/modem/modemlist.json',

  load: function () {
    return Promise.all([
      L.resolveDefault(fs.list('/dev'), null),
      L.resolveDefault(fs.read_direct('/sys/kernel/debug/usb/devices', ['-r'])),
      L.resolveDefault(fs.exec_direct('/usr/bin/mmcli', ['-L', '-J']), null)
    ]);
  },

  fileModemDialog: baseclass.extend({
    __init__: function (file, title, description, callback, fileExists = false) {
      this.file = file;
      this.title = title;
      this.description = description;
      this.callback = callback;
      this.fileExists = fileExists;
    },

    load: function () {
      return L.resolveDefault(fs.read(this.file), '');
    },

    handleSave: function (ev) {
      let textarea = document.getElementById('widget.modal_content');
      let value = textarea.value.trim().replace(/\r\n/g, '\n') + '\n';

      return fs.write(this.file, value)
        .then(rc => {
          textarea.value = value;
          popTimeout(null, E('p', _('Contents have been saved.')), 5000, 'info');
          if (this.callback) {
            return this.callback(rc);
          }
        })
        .catch(e => {
          ui.addNotification(
            null,
            E('p', _('Unable to save the contents') + ': %s'.format(e.message))
          );
        })
        .finally(() => {
          ui.hideModal();
        });
    },

    error: function (e) {
      if (!this.fileExists && e instanceof Error && e.name === 'NotFoundError') {
        return this.render();
      } else {
        ui.showModal(
          this.title,
          [
            E('p', {}, _('Unable to read the contents') + ': %s'.format(e.message)),
            E('div', { 'class': 'right' }, [
              E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
            ])
          ],
          'cbi-modal'
        );
      }
    },

    show: function () {
      ui.showModal(null, E('p', { 'class': 'spinning' }, _('Loading')));
      this.load()
        .then(content => {
          ui.hideModal();
          return this.render(content);
        })
        .catch(e => {
          ui.hideModal();
          return this.error(e);
        });
    },

    render: function (content) {
      ui.showModal(
        this.title,
        [
          E('p', this.description),
          E('textarea', {
            'id': 'widget.modal_content',
            'class': 'cbi-input-textarea',
            'style': 'width:100% !important; height: 60vh; min-height: 500px;',
            'wrap': 'off',
            'readonly': 'true',
            'spellcheck': 'false'
          }, content.trim()),
          E('div', { 'class': 'right' }, [
            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
          ])
        ],
        'cbi-modal'
      );
    }
  }),

  render: function (data) {
    let showModemDialog = new this.fileModemDialog(
      this.modemPath,
      _('Modems found'),
      _("List of found modems. Not all modems may be shown."),
    );

    fs.write('/etc/modem/modemlist.json', '');

    let dlines = data[1].trim().split(/\n/).map(function (line) {
      return line.replace(/^<\d+>/, '');
    });
    let devslist = dlines.join('\n');
    const alldevs = devslist.split('\n\n');
    const results = [];

    for (const modem of alldevs) {
      const lines = modem.split('\n');
      let vendor = '';
      let pid = '';
      let manufacturer = '';
      let product = '';
      let serialnumber = '';
      let driver = '';
      let bus = '';

      for (const line of lines) {
        if (line.includes('Driver=hub') || line.includes('Driver=usb-storage') || line.includes('Driver=usblp')) {
          driver = line.split('Driver=')[1].trim();
          break;
        }
        if (line.includes('Spd=')) {
          const match = line.match(/Spd=([^ ]+)/);
          if (match && match[1]) bus = match[1].trim();
        }
        if (line.includes('Vendor=')) {
          const match = line.match(/Vendor=([^ ]+)/);
          if (match && match[1]) vendor = match[1].trim();
        }
        if (line.includes('ProdID=')) {
          const match = line.match(/ProdID=([^ ]+)/);
          if (match && match[1]) pid = match[1].trim();
        }
        if (line.includes('Manufacturer=')) {
          const match = line.match(/Manufacturer=(.*)/);
          if (match && match[1]) manufacturer = match[1].trim();
        }
        if (line.includes('Product=')) {
          const match = line.match(/Product=(.*)/);
          if (match && match[1]) product = match[1].trim();
        }
        if (line.includes('SerialNumber=')) {
          const match = line.match(/SerialNumber=(.*)/);
          if (match && match[1]) serialnumber = match[1].trim();
        }
      }

      if (driver === '' && (manufacturer !== '' || product !== '')) {
        const result = {
          Manufacturer:  manufacturer,
          Product:       product,
          Vendor:        vendor,
          ProdID:        pid,
          Bus_speed:     bus,
          Serial_Number: serialnumber
        };
        results.push(result);
      }
    }

    const outputJSON = JSON.stringify(results, null, 2);
    let countm = Object.keys(results).length;

    fs.write('/etc/modem/modemlist.json', outputJSON + '\n');

    let m, s, o, snr;

    m = new form.Map('defmodems', _('Defined modems'),
      _('Interface to define the available modems. The list of modems will make it easier for the user to switch between modems in LuCI.')
    );

    s = m.section(form.TypedSection, 'general', _(''));
    s.anonymous = true;
    s.addremove = false;

    o = s.option(form.Button, '_show_modem_btn', _('Show modems found'),
      _('Currently, only modems connected via USB are searched for.')
    );
    o.onclick = () => showModemDialog.show();
    o.inputtitle = _('Show');
    o.inputstyle = 'edit btn';

    s = m.section(form.GridSection, 'defmodems', _('Modem(s)'));
    s.anonymous = true;
    s.addremove = true;
    s.sortable = true;
    s.nodescriptions = true;
    s.addbtntitle = _('Add new modem settings...');

    s.tab('general', _('Modem Settings'));

    o = s.taboption('general', form.Value, 'modem', _('Manufacturer / Product'),
      _("Enter modem name manually if the suggested name is not obvious. \
       <br /><br /><b>Important</b> \
       <br />The modem name is only searched for modems connected via USB.")
    );

    for (let i = 0; i < countm; i++) {
      o.value(results[i].Manufacturer + ' ' + results[i].Product);
    }
    o.placeholder = _('Please select a modem');
    o.textvalue = getmodem.bind(o);
    o.rmempty = false;

    o = s.taboption('general', form.ListValue, 'modemdata', _('Reading data via'),
      _('Select method for reading data from the modem. <br /> \
        <br />serial port: <br /> \
        Select one of the available ttyUSBX / ttyACMx / wwan0atX / mhi_DUN ports.<br /> \
        <br />ecm: <br /> \
        Enter the IP address 192.168.X.X under which the modem (Huawei) is available.<br /> \
        <br />uqmi: <br /> \
        Select one of the available cdc-wdmX ports.<br /> \
        <br />ModemManager: <br /> \
        Select one of the searched modem identifiers.'));
    o.value('serial', _('serial'));
    o.value('ecm', _('ecm'));
    o.value('uqmi', _('uqmi'));
    o.value('mm', _('modemmanager'));
    o.exclude = s.section;
    o.nocreate = true;
    o.rmempty = false;

    o = s.taboption('general', form.Value, 'comm_port', _('Port / IP / Modem identifier'));
    o.rmempty = false;
    o.textvalue = getmodemdata.bind(o);
    o.modalonly = false;

    o = s.taboption('general', form.Value, 'comm_serial', _('Port for communication'));
    o.depends('modemdata', 'serial');

    data[0].sort((a, b) => a.name > b.name);
    data[0].forEach(dev => {
      if (dev.name.match(/^ttyUSB/) || dev.name.match(/^ttyACM/) || dev.name.match(/^mhi_/) || dev.name.match(/^wwan/)) {
        o.value('/dev/' + dev.name);
      }
    });
    o.placeholder = _('Please select a port');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Value, 'comm_ecm', _('IP adress'));
    o.depends('modemdata', 'ecm');
    o.placeholder = _('Enter IP adress');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };
    
    o.validate = function (section_id, value) {
        if (!/^[0-9.]+$/.test(value)) {
            return _('Only numbers and dots are allowed');
        }

        let m = value.match(/^192\.168\.(\d{1,3})\.(\d{1,3})$/);
        if (m) {
            let p3 = parseInt(m[1], 10);
            let p4 = parseInt(m[2], 10);
            if (p3 >= 0 && p3 <= 255 && p4 >= 0 && p4 <= 255) {
                return true;
            }
        }
        return _('Enter a valid IP address in the format 192.168.X.X');
    };

    o = s.taboption('general', form.Value, 'comm_uqmi', _('Port for communication'));
    o.depends('modemdata', 'uqmi');

    data[0].sort((a, b) => a.name > b.name);
    data[0].forEach(dev => {
      if (dev.name.match(/^cdc-wdm/)) {
        o.value('/dev/' + dev.name);
      }
    });
    o.placeholder = _('Please select a QMI/MBIM port');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'forced_plmn_uqmi', _('Force PLMN'), _('Force reading PLMN from file.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'uqmi');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'forced_plmn', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'onproxy', _('MBIM device'), _('Select if you want to read from MBIM.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'uqmi');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'onproxy', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Value, 'comm_mm', _('Modem id'));
    o.depends('modemdata', 'mm');

    data[0].sort((a, b) => a.name > b.name);
    try {
      let mmData = JSON.parse(data[2]);
      if (mmData['modem-list'] && Array.isArray(mmData['modem-list'])) {
        mmData['modem-list'].forEach(modem => {
          o.value(modem, _('modem ') + modem.split('/').pop());
        });
      }
    } catch (e) {
      console.error('MMCLI scan error:', e);
    }

    o.placeholder = _('Please select a modem id');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'forced_plmn_mm', _('Force PLMN'), _('Force reading PLMN from file.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'mm');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'forced_plmn', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', widgets.NetworkSelect, 'network', _('Assigned interface'), _('Interface assigned to modem.'));
    o.rmempty = false;
    o.default = 'wan';

    o = s.taboption('general', form.Value, 'user_desc', _('User description'));
    o.rmempty = true;
    o.modalonly = true;
    o.placeholder = _('Optional');

    o = s.taboption('general', form.Value, 'user_desc', _('User description (optional)'));
    o.rawhtml = true;
    o.remove = function () {};
    o.modalonly = false;
    o.textvalue = usrdesc.bind(o);

    return m.render();
  }
});
