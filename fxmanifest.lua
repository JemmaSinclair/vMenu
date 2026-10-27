fx_version 'cerulean'
game 'gta5'

author 'Jemma Sinclair'
description 'Automated stand-in migrator for vMenu to vMenu.Enhanced'
version '1.0.0'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/themes.css',
    'html/app.js',
    'data/weapons.json',
    'data/weapon-components.json',
    'data/ped-models.json',
}

client_scripts {
    'client/lookup_data.js',
    'client/converter.js',
    'client/migrator.js',
}

