#!/usr/bin/env node

/* eslint no-process-exit:off */
/**
 * Created by kras on 13.07.16.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const extend = require('extend');

const worker = require('../lib/export');

let config_file = process.argv[2] || process.env.ION_CONFIG_PATH || 'config';

config_file = path.isAbsolute(config_file)
  ? config_file
  : path.normalize(path.join(process.cwd(), config_file));

const config = fs.existsSync(config_file) ? require(config_file) : {};

const default_config = require('../config');

const { di } = require('@iondv/core');
const { log: { IonLogger } } = require('@iondv/commons');
const { t, lang, load } = require('@iondv/i18n');

lang(config.lang);

const alias = di.alias;

const sysLog = new IonLogger({});

const params = {
  dst: '../out',
  ver: null,
  ns: '',
  skipData: false,
  skipFiles: false,
  fileDir: false
};

var setParam = false;

// jshint maxstatements

process.argv.forEach(function (val) {
  if (val === '--file-dir') {
    setParam = 'fileDir';
  } else if (val === '--acl') {
    params.exportAcl = 'json';
    setParam = 'exportAcl';
  } else if (val === '--nodata') {
    params.skipData = true;
  } else if (val === '--nofiles') {
    params.skipFiles = true;
  } else if (val.substr(0, 2) === '--') {
    setParam = val.substr(2);
  } else if (setParam) {
    params[setParam] = val;
  }
});

// Application binding
load(path.normalize(path.join(process.cwd(), 'i18n')), null, config.lang)
  .then(() => di(
    'boot',
    extend(
      true,
      default_config.bootstrap,
      config.bootstrap || {}
    ),
    {sysLog: sysLog}
  ))
  .then(scope =>
    di(
      'app',
      extend(true, default_config.di, config.di, scope.settings.get('plugins') || {}),
      {},
      'boot',
      ['dataSources', 'metaRepo', 'dataRepo', 'workflows', 'sequenceProvider', 'accounts', 'roleAccessManager'],
      ['auth', 'application']
    )
  )
  .then(scope => alias(scope, scope.settings.get('di-alias')))
  .then(scope =>
    worker(
      params.dst,
      {
        metaRepo: scope.metaRepo,
        dataRepo: scope.dataRepo,
        workflows: scope.workflows,
        sequences: scope.sequenceProvider,
        accounts: scope.accounts,
        accessManager: scope.roleAccessManager,
        log: scope.sysLog,
        namespace: params.ns,
        version: params.ver !== '-last' ? params.ver : null,
        skipData: params.skipData,
        skipFiles: params.skipFiles,
        exportAcl: params.exportAcl,
        fileDir: params.fileDir,
        lastVersion: params.ver === '-last'
      }).then(() => scope)
  )
  .then(scope => scope.dataSources.disconnect())
  .then(() => {
    console.info(t('Export successfully done.'), params.dst);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(130);
  });
