const { populateCombatData, populateCombatWindow, populateCombatControls } = require("../sessionTools.js")
const { simulateCPUSPAssign, simulateCPUAbilityAssign, clone, runEnemyCombatAI} = require("../tools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"hallAttempt"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let opponent = clone(session.session_data.town.hallOwner)
        opponent.cpu = true

        let newSession = {
            type:"combat",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:session.user_ids,
            server_id:interaction.guildId,
            session_data:populateCombatData([
                clone(session.session_data.player),
                opponent                
            ],{
                fightType:"pve",
                alliances:[0,1],
                canFlee:false,
                rewardPlayer:false,
                combatRewards:{
                    overwriteHallOwner:clone(session.session_data.player)
                }
            })
        }


        runEnemyCombatAI(newSession.session_data.fighters)

        interaction.update({
            content:" ",
            components:populateCombatControls(newSession),
            embeds:populateCombatWindow(newSession)
        })

        callback({
            addSession: newSession,
            removeSession: session
        })
    }
}