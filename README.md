# luci-app-modemdata
![GitHub release (latest by date)](https://img.shields.io/github/v/release/4IceG/luci-app-modemdata?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/4IceG/luci-app-modemdata?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/4IceG/luci-app-modemdata?style=flat-square)
![GitHub All Releases](https://img.shields.io/github/downloads/4IceG/luci-app-modemdata/total)

> [!NOTE]
> <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_United_Kingdom.png" height="24"> 
LuCI JS interface for [modemdata](https://github.com/obsy/modemdata) package. In the future, it will replace luci-app-3ginfo-lite.
>
> <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_Poland.png" height="24"> Interfejs LuCI JS dla pakietu [modemdata](https://github.com/obsy/modemdata). W przyszłości zastąpi on pakiet luci-app-3ginfo-lite.

> [!IMPORTANT]
> Due to the layout, the package is dedicated to the luci-theme-bootstrap.
> 
> Ze względu na układ pakiet dedykowany jest dla motywu luci-theme-bootstrap.   

### Supported usb devices (requires updating):
``` bash
03f0581d - # Huawei ME906s-158
03f0a31d - # Huawei ME906s-158
05c69026 - # ASKEY WWHC050
05c69215 - # Quectel EC25
05c69625 - # Yuge CLM920 NC_5
05c6f601 - # MEIG SLM750-V
0e8d7126 - # Fibocom FM350-GL
0e8d7127 - # Fibocom FM350-GL
119968a2 - # Sierra Wireless MC7710
11999071 - # DW5811e Snapdragon X7 LTE (EM7455B)
11999091 - # Sierra Wireless EM7565 (generic)
119990d3 - # Sierra Wireless EM9190
12d11506 - # Huawei ME906s-158
12d1155e - # Huawei ME906s-158
12d1156c - # Huawei ME906s-158
12d115c1 - # Huawei ME906s-158
1435d181 - # WNC D19QA
1435d191 - # WNC D19QA
16907588 - # ASKEY WWHC050
19d20167 - # ZTE MF821
19d20189 - # ZTE MF290
19d21275 - # ZTE ZM8630A
19d21432 - # ZTE MF286A
19d21432 - # ZTE MF286A
19d21485 - # ZTE MF286D
19d21485 - # ZTE MF289F
19d21489 - # ZTE MF286R
1bc71040 - # Telit LM940
1bc71201 - # Telit LE910-EUG
1e0e9000 - # SIMCOM SIM8200EA-M2
1e0e9001 - # SIMCOM SIM8200EA-M2
1e0e9003 - # SIMCOM SIM8200EA-M2
1e2d00b3 - # Thales MV31-W
1e2d00b7 - # Thales MV31-W
20202033 - # BroadMobi BM806U
2c7c0125 - # Quectel EC25
2c7c0306 - # Quectel EG06
2c7c030b - # Quectel EG06
2c7c0512 - # Quectel EM12-G
2c7c0620 - # Quectel EM12-G
2c7c0800 - # Quectel RG500Q-EA 
2c7c0800 - # Quectel RG500Q-EA
2c7c0800 - # Quectel RG502Q-EA
2c7c0800 - # Quectel RM500U-CNV
2c7c0800 - # Quectel RM520N-GL
2c7c0801 - # Quectel RG502Q-EA
2c7c0900 - # Quectel RG502Q-EA
2c7c6026 - # Quectel EC200T-EU
2cb70007 - # Fibocom L850
2cb70104 - # Fibocom FM150/190
2cb70104 - # Fibocom FM150
2cb70104 - # Fibocom FM190
2cd20001 - # Mikrotik R11e-LTE
2cd20004 - # Mikrotik R11e-LTE6
413c81b1 - # DW5811e Snapdragon X7 LTE (EM7455B)
413c81b6 - # DW5811e Snapdragon X7 LTE (EM7455B)
413c81d7 - # DW5821e Snapdragon X20 LTE
8087095a - # Fibocom L860
```
### Supported pci devices:
``` bash
105be0b0 - # Foxconn T99W175
105be0b0 - # Dell DW5930e
17cb0308 - # Quectel RG500Q-EA
17cb0308 - # Quectel RG502Q-EA
17cb0308 - # Quectel RM500U-CNV
17cb0308 - # Quectel RM520N-GL
17cb0308 - # Quectel RG502Q-EA
17cb5201 - # Quectel RG500Q-EA
17cb5201 - # Quectel RG502Q-EA
17cb5201 - # Quectel RM500U-CNV
17cb5201 - # Quectel RM520N-GL
```

### <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_United_Kingdom.png" height="24"> Design concept / <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_Poland.png" height="24"> Koncepcja wyglądu

> "Modem(s)" window / Okno Modem(-ów):

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md1.png?raw=true)

> "Diagnostics" window / Okno diagnostyki:

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md2.png?raw=true)

> "Defined modems" window / Okno zdefiniowanych modem(-ów):

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md3.png?raw=true)

> "Defined modems" window / Okno zdefiniowanych modem(-ów):

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md3b.png?raw=true)

> "Configuration" window / Okno konfiguracji pakietu:

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md4.png?raw=true)

> "Package update and support" window / Okno aktualizacji pakietu i wsparcia:

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md5.png?raw=true)

### <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_United_Kingdom.png" height="24"> Thanks to / <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_Poland.png" height="24"> Podziękowania dla
- [obsy (Cezary Jackiewicz)](https://github.com/obsy)
- [Users of the eko.one.pl forum](https://eko.one.pl/forum/viewtopic.php?id=20096)
