const abilities = require("../commands/abilities.js")
const {populateManegeAbilityWindow, populateManageAbilityControls } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"rememberAbility"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "manageAbilities"){
            if(session.session_data.player.abilities.length < 6){
                session.session_data.player.abilities.push(session.session_data.player.abilityMemory[parseInt(interaction.values[0])])
                session.session_data.player.abilityMemory.splice(parseInt(interaction.values[0]),1)
                interaction.update({
                    content:" ",
                    embeds:populateManegeAbilityWindow(session),
                    components:populateManageAbilityControls(session) 
                })
                
                callback({
                    updateSession:session
                })
            } else {
                interaction.reply({ content: 'You have too many abilities and must remove one first', ephemeral: true });
            }
        }
    }
}