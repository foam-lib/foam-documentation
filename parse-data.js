const fs = require('fs');
const path = require('path');
const jsdoc_parse = require("jsdoc-parse");
const colors = require('colors');

const LOG_PREPARE_DATA = false;
const PATH_OUT = './data';

var modulesToParse = require('./parse-config.json').modules;

/*--------------------------------------------------------------------------------------------------------------------*/
// PREPARE DATA
/*--------------------------------------------------------------------------------------------------------------------*/

function prepareData(data){
    for(var i = data.length - 1; i > -1; i--){
        var item = data[i];

        //foam-lib specific tags
        var customTags = {};
        for(var j = 0,l = item.customTags ? item.customTags.length : 0; j < l; ++j){
            var tag = item.customTags[j];
            customTags[tag.tag] = tag.value !== undefined ? tag.value : true;
        }
        var parsed = {
            name : item.name,
            type : item.kind,
            description : item.description || '',
            category : item.category || null,
            examples : item.examples || []
        };
        var type = parsed.type;
        var scope = item.scope;
        //class
        if(type === 'class'){
            parsed.extends = item.augments || [];
        }else{
            //es5 setter/getter
            if(customTags.custom_setter || customTags.custom_getter){
                scope = customTags.custom_scope || scope;
                parsed.name = item.memberof;
                parsed.memberOf = customTags.custom_memberof;
                parsed.type = customTags.custom_setter ? 'setter' : 'getter';
                //object member
            }else{
                parsed.memberOf = item.memberof;
            }
            //scopes
            parsed.scope = scope;
            //function
            if(type === 'constructor' ||
                type === 'function' ||
                type === 'setter' ||
                type === 'getter'){
                //function return type
                var returns;
                if(item.returns){
                    returns = new Array(item.returns.length);
                    for(var j = 0; j < returns.length; ++j){
                        returns[j] = item.returns[j].type.names[0];
                    }
                    //no return type, default to 'void'
                }else{
                    returns = type === 'constructor' ? [parsed.memberOf] : ['void'];
                }
                parsed.returns = returns;
                //function parameters
                var params;
                if(item.params){
                    params = new Array(item.params.length);
                    for(var j = 0; j < params.length; ++j){
                        var param = item.params[j];
                        params[j] = {
                            name : param.name,
                            description : param.description || '',
                            optional : !!param.optional,
                            types : param.type ? param.type.names : []
                        }
                    }
                    //not parameters
                }else{
                    params = [];
                }
                parsed.params = params;
            }
            //constant
            if(type === 'constant'){
                if(item.isEnum){
                    type = parsed.type = 'enum';
                }
            }
        }
        //enum or object entries
        if(item.properties){
            var properties  = item.properties;
            var properties_ = new Array(properties.length);
            for(var j = 0; j < properties.length; ++j){
                var property = properties[j];
                properties_[j] = {
                    name : property.name,
                    type : property.type.names,
                    description : property.description
                }
            }
            parsed.properties = properties_;
        }
        //correct type
        if(parsed.type === 'member'){
            parsed.type = item.type.names[0];
        }
        if(LOG_PREPARE_DATA){
            console.log('entry',JSON.stringify(item));
            console.log('---');
            console.log('parsed',JSON.stringify(parsed));
            console.log('--------------------------------------------------------------------------------------------');
        }

        data[i] = parsed;
    }
    return data;
}

/*--------------------------------------------------------------------------------------------------------------------*/
// PARSE DATA
/*--------------------------------------------------------------------------------------------------------------------*/

function parseData(data){
    data = prepareData(data);

    var classes = [];
    var classKeyIndexMap = {};
    var constants = [];
    var enums = [];
    var functions = [];

    //get classes
    for(var i = data.length - 1; i > -1; i--){
        var item = data[i];
        if(item.type !== 'class'){
            continue;
        }
        classes.push({
            name: item.name,
            description: item.description,
            properties: {
                static : [],
                instance : []
            },
            methods : {
                static : [],
                instance : []
            }

        });
        classKeyIndexMap[item.name] = classes.length - 1;
        data.splice(i,1);
    }

    //get class properties & methods
    for(var name in classKeyIndexMap){
        var class_ = classes[classKeyIndexMap[name]];
        var class_properties = class_.properties;
        var class_methods    = class_.methods;

        for(var i = data.length - 1; i > -1; i--){
            var item = data[i];
            if(item.memberOf !== name){
                continue;
            }
            switch(item.type){
                case 'constructor':
                    class_.constructor = {
                        description : item.description,
                        examples : item.examples,
                        params : item.params
                    };
                    data.splice(i,1);
                    break;
                case 'function':
                    class_methods[item.scope].push({
                        name : item.name,
                        description : item.description,
                        category : item.category,
                        examples : item.examples,
                        returns : item.returns,
                        params : item.params
                    });
                    data.splice(i,1);
                    break;
                case 'string':
                case 'number':
                    class_properties[item.scope].push({
                        name : item.name,
                        type : item.type,
                        description : item.description,
                        category : item.category,
                        examples : item.examples
                    });
                    data.splice(i,1);
                    break;
                default:
                    break;
            }
        }

        //get global constants, objects, enums, functions
        for(var i = data.length - 1; i > -1; i--){
            var item = data[i];

            switch(item.type){
                case 'constant':
                    constants.push({
                        name : item.name,
                        description : item.description,
                        category : item.category,
                        examples : item.examples,
                        properties : item.properties
                    });
                    data.splice(i,1);
                    break;
                case 'enum':
                    enums.push({
                        name : item.name,
                        description : item.description,
                        category : item.category,
                        examples : item.examples,
                        properties: item.properties
                    });
                    data.splice(i,1);
                    break;
                case 'function':
                    functions.push({
                        name: item.name,
                        description: item.description,
                        category : item.category,
                        examples : item.examples,
                        params : item.params,
                        returns : item.returns
                    });
                    data.splice(i,1);
                    break;
                default:
                    break;
            }
        }
    }

    if(data.length > 0){
        console.log('Unhandled documentation:'.red);
        console.log(JSON.stringify(data,null,'\t'));
    }

    return {
        classes : classes,
        constants : constants,
        enums : enums,
        functions : functions
    };
}

function parse(module_string,cb){
    var pathModule = '../' + module_string;
    var files = fs.readdirSync(pathModule);

    for(var i = files.length - 1; i > -1; i--){
        var file = files[i];
        if(file.indexOf('.js') !== -1){
            files[i] = pathModule + '/' + file;
            continue;
        }
        files.splice(i,1);
    }

    var packagePath = pathModule + '/package.json';
    var packageIndex = files.indexOf(packagePath);

    if(packageIndex === -1){
        throw new Error('No package.json');
    }
    files.splice(packageIndex,1);

    var config_jsdoc_path = pathModule + '/jsdoc-config.json';
    var config_jsdoc = null;

    //jsdoc config
    if(files.indexOf(config_jsdoc_path) !== -1){
        //prefilter jsdoc config excludes
        //TODO: cleanup
        config_jsdoc = JSON.parse(fs.readFileSync(config_jsdoc_path));
        if(config_jsdoc.source){
            if(config_jsdoc.source.exclude){
                var excludes = config_jsdoc.source.exclude;
                for(var i = 0; i < excludes.length; ++i){
                    var exclude = path.basename(excludes[i]);
                    for(var j = files.length - 1; j > -1; j--){
                        if(path.basename(files[j]) === exclude){
                            files.splice(j,1);
                        }
                    }
                }
            }
        }
        files.splice(files.indexOf(config_jsdoc_path),1);
    //no config available
    }else{
        config_jsdoc_path = null;
    }

    var package_ = JSON.parse(fs.readFileSync(packagePath));
    var data = {
        name : package_.name,
        version : package_.version,
        repository : package_.repository,
        modules : []
    };

    for(var i = 0; i < files.length; ++i){
        data.modules.push({
            path : files[i],
            items : []
        });
    }

    var config = {
        src : null,
        private : true
    };

    if(config_jsdoc_path){
        config.conf = config_jsdoc_path;
    }

    //parse module
    function parseModule(module,cb){
        config.src = module.path;
        var stream = jsdoc_parse(config);
        stream.on('data',function(data){
            module.items = parseData(JSON.parse(data));
            cb();
        });
    }

    //async step modules
    var indexModule = 0;
    var numModules = data.modules.length;

    function onFileParsed(){
        if(++indexModule === numModules){
            cb(data);
            return;
        }
        parseModule(data.modules[indexModule],onFileParsed);
    }

    parseModule(data.modules[indexModule],onFileParsed);
}

console.log('foam-lib jsdoc documentation parse:'.yellow);

//parse modules
for(var i = 0; i < modulesToParse.length; ++i){
    parse(modulesToParse[i],function(data){
        console.log('└──',data.name);
        for(var i = 0; i < data.modules.length; ++i){
            console.log('   └──',path.basename(data.modules[i].path));
        }

        fs.writeFile(
            path.join(PATH_OUT,data.name + '.json'),
            JSON.stringify(data,null,'\t')
        );
    });
}

//write overview
fs.writeFile(
    path.join(PATH_OUT,'foam-modules.json'),
    JSON.stringify({
        modules : modulesToParse
    },null,'\t')
);

