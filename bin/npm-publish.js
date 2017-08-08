#!/usr/bin/env node

var program = require('commander');
var fluidPublish = require('fluid-publish');
var path = require('path');
var fs = require('fs');
var extend = require('extend');
var lodash = require('lodash');
var execSync = require("child_process").execSync;


function getTags(version) {
  const tags = execSync('git tag').toString();
  const tagList = tags.split('\n');

  for (let i = 0; i < tagList.length; i++) {
    const tag = tagList[i];
    console.log(`${tag}${tag.trim() === version ? ` <---` : ``}`);
  }
}

program
  .version(require('../package.json').version)
  .option('--test', 'specifies that a tarball should be created instead of publishing to NPM')
  .option('--release', 'should publish npm as release')
  .description('Publish npm module');

program.on('--help', function () {
  console.log(' for examples:');
  console.log('');
  console.log('   npm-publish');
  console.log('   npm-publish --release');
  console.log('');
});

program.parse(process.argv);

//override default date format and change timestamp of current revision to now time
fluidPublish.convertToISO8601 = function(timestamp) {
  var date = new Date().toISOString();
  //remove {':', '-'} symbols from format because npm publish doesn't work
  return date.split(':').join('').split('-').join('');
};

if (program.release) {
  var updatingVersionMessage = 'Updating to a version to ';
  var currentPath = process.cwd();
  var packageFilename = path.join(currentPath, 'package.json');
  var version = require(packageFilename).version;

  // if (!program.test) {
  //   // execSync(`node ${path.resolve(__dirname, './update-changelog.js')}`, { stdio: 'inherit' });
  //   // execSync('git push');
  // }

  let isSuccess = true;

  let fluidPublishOptions = {
    "pushVCTagCmd": "git push origin v${version}",
    "vcTagCmd": "git tag -a v${version} -m \"Tagging the ${version} release\""
  };

  try {
    fluidPublish.standard(program.test, fluidPublishOptions);
  } catch(err) {
    console.log('Publish error');

    // let publishPkg = fluidPublish.getPkg(__dirname);
    // let opts = extend(true, {}, publishPkg.defaultOptions, fluidPublishOptions);
    // cleanup changes
    // fluidPublish.clean(opts.moduleRoot, opts);

    isSuccess = false;
  }


  // 1. Проверить наличие тегов

  if (!program.test && isSuccess) {
    execSync(`node ${path.resolve(__dirname, './update-changelog.js')}`, { stdio: 'inherit' });
    execSync('git push');

    getTags(version);

    var vNumbers = version.split(".");
    var lastNumber = parseInt(vNumbers[vNumbers.length - 1], 10);
    vNumbers[vNumbers.length - 1] = lastNumber + 1;
    var targetVersion = vNumbers.join('.');

    var VERSION_REGEXP = new RegExp(
      '([\'|\"]?version[\'|\"]?[ ]*:[ ]*[\'|\"]?)[\\d||A-a|.|-]*([\'|\"]?)', 'gi');

    var packageData = fs.readFileSync(packageFilename).toString();
    packageData = packageData.replace(VERSION_REGEXP, "\"version\": \"" + targetVersion + "\"");
    fs.writeFileSync(packageFilename, packageData);

    execSync('git add package.json');
    execSync(`git commit -m "${updatingVersionMessage} ${targetVersion}"`);
    execSync('git push');
  }
} else {
  fluidPublish.dev(program.test, {
    "devVersion": "${version}-${preRelease}.${timestamp}",
    "devTag": "SNAPSHOT",
    "publishCmd": "npm publish -f"
    // "changesCmd": "printf ''"
  });
}
