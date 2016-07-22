const fs = require('fs');
const jsdoc_parse = require("jsdoc-parse");

//modules to parse
const MODULES_TO_PARSE = [
    'app',
    'color',
    'context-2d',
    'context-2d-svg',
    'context-gl'
];

function parse(module_string,cb){
    var path = '../foam-' + module_string;
    var files = fs.readdirSync(path);

    for(var i = files.length - 1; i > -1; i--){
        var file = files[i];
        if(file.indexOf('.js') !== -1){
            files[i] = path + '/' + file;
            continue;
        }
        files.splice(i,1);
    }

    var packagePath = path + '/package.json';
    var packageIndex = files.indexOf(packagePath);

    if(packageIndex === -1){
        throw new Error('No package.json');
    }
    files.splice(packageIndex,1);

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

    function parse_jsdoc_data(data){
        data = JSON.parse(data);

        var classes = [];
        var classKeyIndexMap = {};
        var global_constants = [];
        var global_enums = [];
        var global_objects = [];
        var global_functions = [];

        data.splice(i,1);

        //parse function
        function parseFunction(data){
            return {
                name : data.name,
                description : data.description,
                params : data.params,
                examples : data.examples,
                return : null
            }
        }

        for(var i = data.length - 1; i > -1; i--){
            var item = data[i];
            //move custom tags to map
            if(item.customTags){
                var customTags = {};
                for(var j = 0; j < item.customTags.length; ++j){
                    var tag = item.customTags[j];
                    customTags[tag.tag] = tag.value !== undefined ? tag.value : true;
                }
                item.customTags = customTags;
            }
            //extract classes
            if(item.kind === 'class'){
                var name = item.name;
                if(!classKeyIndexMap[name]){
                    classes.push({
                        name : name,
                        description : item.description,
                        constructor : null,
                        properties : {
                            static : [],
                            instance : []
                        },
                        functions : {
                            static : [],
                            instance : []
                        }
                    });
                    classKeyIndexMap[name] = classes.length - 1;
                    data.splice(i,1);
                }
            //extract non-class members
            }else if(!item.memberof){
                var name = item.name;
                var description = item.description;
                //global
                if(item.kind === 'constant'){
                    var type  = item.type.names[0];
                    var typel = type.toLowerCase();
                    //enum
                    if(item.isEnum){
                        var properties = item.properties;
                        for(var j = 0; j < properties.length; ++j){
                            var property = properties[j];
                            property.type = property.type.names[0];
                        }
                        global_enums.push({
                            name: name,
                            description : description,
                            type: type,
                            properties: item.properties
                        });
                        data.splice(i,1);
                    //object
                    } else if(typel === 'object') {
                        global_objects.push({
                            name: name,
                            description: description,
                            properties: item.properties
                        });
                        data.splice(i,1);
                    //primitive
                    } else {

                    }
                }else if(item.kind === 'function'){
                    global_functions.push(parseFunction(item));
                    data.splice(i,1);
                } else {

                }
            }
        }
        //extract class properties
        for(var name in classKeyIndexMap){
            var class_ = classes[classKeyIndexMap[name]];
            var functions = class_.functions;
            var properties = class_.properties;

            for(var i = data.length - 1; i > -1; i--){
                var item = data[i];
                var isES5SetterGetter = item.customTags && item.customTags.custom_memberof === name;
                if(item.memberof !== name && !isES5SetterGetter){
                    continue;
                }
                switch(item.kind){
                    case 'constructor':
                        class_.constructor = parseFunction(item);
                        break;
                    case 'function':
                        if(isES5SetterGetter){
                            var scope = item.scope;
                            var type = item.customTags.custom_setter ? 'set' : 'get';
                            item.name = item.memberof; //actual function name
                            item = parseFunction(item);
                            item.type = type;
                            functions[scope].push(item);
                        }else{
                            functions[item.scope].push(parseFunction(item));
                        }
                        break;
                    default:
                        //
                        break;
                }
                data.splice(i,1);
            }
        }

        if(data.length > 0){
            console.log('Unhandled documentation:');
            console.log(JSON.stringify(data));
        }

        return {
            classes : classes,
            global_constants: global_constants,
            global_enums: global_enums,
            global_objects: global_objects,
            global_functions: global_functions
        };
    }

    //parse module
    function parseModule(module,cb){
        var stream = jsdoc_parse({src : module.path,private : false});
        stream.on('data',function(data){
            module.items = parse_jsdoc_data(data);
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

parse(MODULES_TO_PARSE[0],function(data){

});
