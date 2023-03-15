const {populateManegeAbilityWindow, populateManageAbilityControls } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"removeAbility"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "manageAbilities"){
            if(session.session_data.player.abilities.length > 1){
                if(!session.session_data.player.abilityMemory){
                    session.session_data.player.abilityMemory = []
                }
                session.session_data.player.abilityMemory.push(session.session_data.player.abilities[parseInt(interaction.values[0])])
                session.session_data.player.abilities.splice(parseInt(interaction.values[0]),1)
                interaction.update({
                    content:" ",
                    embeds:populateManegeAbilityWindow(session),
                    components:populateManageAbilityControls(session) 
                })
                
                callback({
                    updateSession:session
                })
            } else {
                interaction.reply({ content: 'You must have one ability at all times', ephemeral: true });
            }
        }
    }
}