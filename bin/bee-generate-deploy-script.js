#! /usr/bin/env node

const AWS = require('aws-sdk');
const argv = require('yargs').argv;
const yaml = require('js-yaml');
const fs = require('fs-extra');

AWS.config.region = 'eu-west-1';

const serviceName = argv['service-name'];
if (!serviceName) {
    console.error(`ERROR: Missing service name, use --service-name=<service name>, e.g. --service-name=jwt-authoriser`);
    process.exit(1);
}

const version = argv['release-version'];
if (!version) {
    console.error(`ERROR: Missing release version number, use --release-version=<version>, e.g. --release-version=1.20.30`);
    process.exit(1);
}

if (!argv.stage) {
    console.error(`ERROR: Missing stage name, use --stage=<stage>, e.g. --stage=contiprelive`);
    process.exit(1);
}

let params;
const parametersFile = argv['parameters-file'];
if (argv.parameters && typeof (argv.parameters) === 'string') {
    params = argv.parameters.split(',').reduce((o, a) => {
        const keyValue = a.split('=');
        if (keyValue.length <= 1) {
            console.error(`ERROR: Invalid value for --parameters option, use --parameters key1=value1,key2=value2,...`);
            process.exit(1);
        }
        const val = keyValue[1];
        o[keyValue[0]] = val.includes(';') ? val.replace(/;/g, ',') : val;
        return o;
    }, {});
} else if (parametersFile && typeof (parametersFile) === 'string') {
    params = yaml.safeLoad(fs.readFileSync(parametersFile, 'utf8'));
}

if (argv.region) {
    AWS.config.region = argv.region;
}

params.Stage = argv.stage;
params.ServiceName = serviceName;
params.Version = version;

let parametersOptions = '';
if (params) {
    let parametersValues = '';
    for (const k in params) {
        const paramVal = (params[k].includes(',')) ? params[k].replace(/,/g, ';') : params[k];
        const val = `${k}=${paramVal}`;
        parametersValues = parametersValues.concat((parametersValues === '') ? val : `,${val}`);
    }
    parametersOptions = `--parameters ${parametersValues}`;

}
const deployScriptForStage = `//This file has been generated by bee-tools https://git-code.asw.zone/RVD/bee-tools.

const shell = require('shelljs');
const argv = require('yargs').argv;

let optionalParams = '';
if(!argv.region || typeof(argv.region) !== 'string') {
    console.error(\`ERROR: Missing region, use --region <region>, e.g. --region eu-west-1 \`);
    process.exit(1);
}
optionalParams = optionalParams.concat(\`--region \${argv.region}\`);
if (argv.profile && typeof(argv.profile) === 'string') {
    optionalParams = optionalParams.concat(\` --profile \${argv.profile}\`);
}

const shellResult = shell.exec(\`bee deploy-service --service-name ${serviceName} --release-version ${version} ${parametersOptions} --stage ${argv.stage} \${optionalParams}\`);
process.exit(shellResult.code);

`;
const outScriptFile = `deploy-${serviceName}-${version}-to-${argv.stage}.js`;
console.log(`Generate deploy script for stage '${argv.stage}: ${outScriptFile}'`);
fs.writeFileSync(outScriptFile, deployScriptForStage, 'utf-8');