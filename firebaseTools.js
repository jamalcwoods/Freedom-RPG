const { initializeApp} = require('firebase/app');
const { getDatabase, ref, set, get, child } = require('firebase/database')
const { firebase } = require("./private/credentials.json");

const app = initializeApp(firebase);
const db = getDatabase()


module.exports = {
    updatePlayerDBData(id,path,data,callback){
        set(ref(db, 'players/' + id + "/" + path), data);
        if(callback){
            callback()
        }
    },
    getPlayerDBData(user,callback){
        get(ref(db, `players/` + user.id)).then((snapshot) => {
            let data = snapshot.val();
            if(data == null){
                callback(false)
            } else {
                callback(data);
            }
        });
    },
    getTownDBData(townID,callback){
        get(ref(db, `towns/` + townID)).then((snapshot) => {
            let data = snapshot.val();
            if(data == null){
                callback(false)
            } else {
                callback(data);
            }
        });
    },
    updateAllTownDBData(towns){
        set(ref(db, 'towns/'), towns);
    },
    updateTownDBData(townID,path,data,callback){
        set(ref(db, 'towns/' + townID + "/" + path), data).then( () =>{
            if(callback){
                callback()
            }
        })
    },
    updatePotentialData(data){
        set(ref(db, 'potential/'), data);
    },
    getPotentialData(callback){
        get(ref(db, `potential`)).then((snapshot) => {
            let data = snapshot.val();
            if(data == null){
                callback(false)
            } else {
                callback(data);
            }
        });
    },
}