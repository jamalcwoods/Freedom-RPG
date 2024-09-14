const { createAbilityDescription} = require("../tools.js")


module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"previewSelectedAbility"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.session_data.temp.abilitySelection){
        let ability = session.session_data.player.abilities[session.session_data.temp.abilitySelection]
            interaction.reply({ content: "__**" + ability.name + "**__\n```\n" + createAbilityDescription(ability) + "```", ephemeral: true });
        } else {
            interaction.reply({ content: "You must select an ability to upgrade first", ephemeral: true });
        }
	},
};