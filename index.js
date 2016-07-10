const fs = require('fs');
const jade = require('jade');

const PATH_DATA = './data/data.json';
const PATH_DATA_TEMPLATE = './data/template-data.json';

//Load data
var data = null;
try {
    data = fs.readFileSync(PATH_DATA,'utf8');
} catch (e){
    data = fs.readFileSync(PATH_DATA_TEMPLATE,'utf8');
}
data = JSON.parse(data);

//Compile template
const template = jade.compileFile('./template/index.jade',{pretty: true});
const html = template(data);

//Out
fs.writeFileSync('./bin/index.html',html);