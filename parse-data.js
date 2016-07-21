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

/**
 * Parses module jsdoc json to
 * [{
 *     name: 'npm-module-name',
 *     version: 0.0.1,
 *     repository: 'repository-url',
 *     modules: [{
 *         path: 'module-path',
 *         items: [{
 *             classes : [{
 *                 name : 'class-name',
 *                 description: 'class-description',
 *                 constructor : {
 *                      name : 'constructor-name',
 *                      description : 'constructor-description',
 *                      params: [{
 *                          name: 'param-name',
 *                          type: 'param-type',
 *                          description: 'param-description',
 *                          default: 'param-default'
 *                      },...]
 *                 },
 *                 properties: [
 *                     static : [
 *                     ],
 *                     instance : [
 *                     ]
 *                 ],
 *                 functions: {
 *                     static : [{
 *                         name : 'function-name',
 *                         description : 'function-description',
 *                         params: [{
 *                             name: 'param-name',
 *                             type: 'param-type',
 *                             description: 'param-description',
 *                             default: 'param-default'
 *                         },...],
 *                         return: {
 *                             type: 'return-type'
 *                         }
 *                     },...],
 *                     instance : [
 *                     ]
 *                 }
 *             },...],
 *             objects : [{
 *             },...]
 *         }]
 *      },...]
 * },...]
 * @param module_string
 * @param cb
 */
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
        name: package_.name,
        version: package_.version,
        repository: package_.repository,
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
        var objects = [];

        for(var i = data.length - 1; i > -1; i--){
            var item = data[i];

            //move custom tags to map
            if(item.customTags){
                var customTags = {};
                for(var j = 0; j < item.customTags.length; ++j){
                    var tag = item.customTags[j];
                    customTags[tag.tag] = tag.value;
                }
                item.customTags = customTags;
            }
            //extract classes
            if(item.kind === 'class'){
                var name = item.name;
                if(!classKeyIndexMap[name]){
                    classes.push({
                        name:name,
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
                }
                data.splice(i,1);
            //extract non-class members
            } else if(!item.memberof){
                objects.push(item);
            }
        }

        //parse function
        function parseFunction(data){
            return {
                name : data.name,
                description: data.description,
                params : data.params,
                return : null
            }
        }

        //extract class properties
        for(var name in classKeyIndexMap){

            var class_ = classes[classKeyIndexMap[name]];
            for(var i = data.length - 1; i > -1; i--){
                var item = data[i];
                var isMember =
                    item.memberof === name ||
                    //handle es5 setter / getter
                    item.customTags && item.customTags.custom_memberof === name;

                if(!isMember){
                    continue;
                }

                switch(item.kind){
                    case 'constructor':
                        class_.constructor = parseFunction(item);
                        break;
                    case 'function':
                        class_.functions[item.scope] = parseFunction(item);
                        break;
                    default:

                        break;
                }

                if(item.kind === 'constructor'){
                    class_.constructor = parse;
                }

                data.splice(i,1);
            }
        }

        return {
            classes : classes,
            objects : objects
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
