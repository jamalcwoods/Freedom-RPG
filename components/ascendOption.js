const { populateLobbyEdit } = require("../sessionTools.js")
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"ascendOption"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "ascend"){

            const embed = new MessageEmbed;
            embed.setColor("#7289da")  
            embed.setTitle(session.session_data.player.name + "'s Ascension")
            
            let optionText = ""

            session.session_data.temp = {
                choice:parseInt(interaction.values[0])
            }

            if(parseInt(interaction.values[0]) > 0){
                let ability = session.session_data.player.abilities[parseInt(interaction.values[0]) - 1] 
                optionText += "Are you sure you would like to ascend by setting **" + ability.name + "** as your signature ability?"
                embed.addField("Ascension - Signature Ability",optionText)
            } else {
                optionText += "Are you sure you would like to ascend by benefitting the town of **" + session.session_data.town.name + "**?"
                embed.addField("Ascension - Town Progression Boost",optionText)
            }

            optionText = "The ascension process will reset your character back to it's original state. This will:\n"
            optionText += "\n- Reset Stats"
            optionText += "\n- Clear Your Inventory and Gold Amount"
            optionText += "\n- Remove All Abilities"
            optionText += "\n\nAchievements will remain untouched"

            embed.addField("WARNING",optionText)
            const choiceButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('ascendResponse_' + session.session_id)
                    .setLabel('Confirm')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('cancel_' + session.session_id)
                    .setLabel('Decline')
                    .setStyle('DANGER')
            );

            interaction.update({
                content: " ",
                embeds: [embed],
                components: [choiceButtons]
            })

            callback({
                updateSession:session
            })
        }
    }
}