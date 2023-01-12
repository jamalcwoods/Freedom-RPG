const { populateCloseInteractionMessage, populateDungeonEvent} = require("../sessionTools.js")
const data = require ("../data.json");

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"triggerDungeon"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let val = componentConfig.args[0]

        let now = new Date();

        let response;
        if(val == "1"){ 
            response = "Dungeon Adventure Cancelled"
            interaction.update(populateCloseInteractionMessage(response,true))
            callback({
                removeSession:session
            })
        } else {
            let newSession = {
                type:"dungeon",
                session_id: Math.floor(Math.random() * 100000),
                user_ids:session.user_ids,
                session_data:{
                    player:session.session_data.player,
                    town:session.session_data.town,
                    eventLineUp:{
                        choices:[],
                        combats:[]
                    },
                    dungeonStart:now.getTime(),
                    dungeonRank:parseInt(interaction.values[0]),
                    eventResult:{},
                    eventNum:0,
                    rankStats:{
                        currentHP:session.session_data.player.stats.hp,
                        currentLives:session.session_data.player.lives,
                        startHP:session.session_data.player.stats.hp,
                        startLives:session.session_data.player.lives,
                        failedChecks:0,
                        skips:0
                    },
                    dangerValue:1,
                    event:{
                        type:"choice",
                        title:"Dungeon Entry",
                        prompt:"You arrive at the entrance of a dungeon on the outskirts of the town of " + session.session_data.town.name + ".",
                        options:[{
                            name:"Enter The Dungeon",
                            description:"Enter the dungeon and begin your adventure",
                            value:null
                        }],
                        noSkip:true
                    }
                }
            }

            if(session.session_data.player.gear){
                let fGear = session.session_data.player.inventory[session.session_data.player.gear]
                if(fGear.stats.hp){
                    newSession.session_data.rankStats.currentHP += fGear.stats.hp * 2
                    newSession.session_data.rankStats.startHP += fGear.stats.hp * 2
                }
            }

            if(session.session_data.player.weapon){
                let fWeapon = session.session_data.player.inventory[session.session_data.player.weapon]
                if(fWeapon.stats.hp){
                    newSession.session_data.rankStats.currentHP += fWeapon.stats.hp * 2
                    newSession.session_data.rankStats.startHP += fWeapon.stats.hp * 2
                }
            }

            while(newSession.session_data.eventLineUp.choices.length < 5){
                let indexA = Math.floor(Math.random() * data.dungeonEvents.choice.length)
                if(!newSession.session_data.eventLineUp.choices.includes(indexA)){
                    newSession.session_data.eventLineUp.choices.push(indexA)
                }
            }

            while(newSession.session_data.eventLineUp.combats.length < 5){
                let indexB = Math.floor(Math.random() * data.dungeonEvents.combat.length) 
                if(!newSession.session_data.eventLineUp.combats.includes(indexB)){
                    newSession.session_data.eventLineUp.combats.push(indexB)
                }
            }

            session.session_data.player.dungeon = newSession.session_id

            let updates = [
                {
                    id:session.user_ids[0],
                    path:"",
                    value:session.session_data.player
                }
            ]

            populateDungeonEvent(newSession,interaction)

            callback({
                removeSession:session,
                updatePlayer:updates,
                addSession:newSession
            })
        }
    }
}