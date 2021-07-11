const fs = require('fs');
const yaml = require('js-yaml');

const { walkTopics } = require('../lib');

const data = fs.readFileSync('topicmap.yaml', { encoding: 'utf8'} );

const sections = data.split(/---\n/).slice(1);
const buckets = sections.map(section => yaml.load(section));

const paths = walkTopics(buckets.find(b => b['Dir'] == 'networking'));
console.log(paths);
