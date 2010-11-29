var defOne = {
  "_id": "load_handler_documents",
  "_rev": "1-09a79bf2b42b64ce9c4bd12a2a86ddfc",
  "trigger": {
       path:"/handler_source_changelistener/*",
       method: "GET",
       parameters: {
         "filesize": "100",
         "filecolor": ":color"
       }
   },
   "workers": {
       "load_document": {
           "db": "*",
           "filetype": ":foo",
           "color": ":color"
       },
       "kill_mirko": {
         "db": "mirkodb"
       }
       
   }
}
 
var message = {
  path: "/handler_source_changelistener/handler_source_changed/json",
  parameters: {filesize: "100", filecolor: "blue", anyother: "bla"}
}