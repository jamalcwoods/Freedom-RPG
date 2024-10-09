// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateTownVisitWindow, populateTownVisitControls, populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"townVisit"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        session.session_data.location = interaction.values[0]
        delete session.session_data.temp
        if(session.type == "townVisit"){
            let tutorial0Flag = session.session_data.player.tutorial == 0 && interaction.values[0] == "training"
            let tutorial6Flag = session.session_data.player.tutorial == 6 && interaction.values[0] == "tavern"
            let tutorial7Flag = session.session_data.player.tutorial == 7 && interaction.values[0] == "market"
            let tutorial8Flag = session.session_data.player.tutorial == 8 && interaction.values[0] == "jobs"
            if(session.session_data.player.tutorial == "completed" && session.session_data.town.raid.raidedFacilities.includes(interaction.values[0]) && !session.session_data.town.raid.bossDefeats){
                interaction.reply({ content: "This facility is currently occupied by raiding forces. Help fight against raiders by visiting the militia hall", ephemeral: true });
            } else {
                if(interaction.values[0] != "end"){
                    if(tutorial0Flag || tutorial6Flag || tutorial7Flag || tutorial8Flag || session.session_data.player.tutorial == "completed"){
                        let overhead = " "
                        
                        if(tutorial7Flag){
                            overhead = "You won't be able to buy anything here since you have no gold currently, but feel free to look around at the items for sale.\nYou will also occasionally earn items from enemies you defeat. You can upgrade these items at the Armory facility later on.\n\nEach town (Discord Server) will have different items for sale based on the town's level\nVisit the Meeting Hall to learn about how towns level up"
                            session.session_data.player.tutorial = 8
                        }

                        if(tutorial8Flag){
                            overhead = "In order for a town to level up requirements must be met by achieving the goals listed below. As the level of a town increases, the market, armory, and training hall will provide higher quality services\n\nThis is something that all members of the town (Discord Server Members) can contribute towards.\nYou can even change your current job to prioritize earning a certain resource for towns you are active in\n\nYou have now completed the tutorial and are officially ready to start your adventure! Good luck out there!\n(Using `/tutorial` will now show info regarding topics not covered in the tutorial that aren't mandatory for regular play)"
                            session.session_data.player.tutorial = "completed"
                        }

                        interaction.update({
                            content: overhead,
                            embeds: populateTownVisitWindow(session),
                            components: populateTownVisitControls(session),
                            ephemeral:true
                        })
        
                        callback({
                            updateSession:session
                        })
                    } else {
                        interaction.reply({ content: "As you are still in the tutorial, your current objective does not involve this facility. Do `/tutorial` for a reminder on where to go next", ephemeral: true });
                    }
                } else {

                    let updates = [
                        {
                            id:session.user_ids[0],
                            path:"",
                            value:session.session_data.player
                        }
                    ]

                    interaction.update(populateCloseInteractionMessage("Town Visit Finished",true))

                    callback({
                        removeSession:session,
                        updatePlayer:updates
                    })
                }
            }
        }
    }
}