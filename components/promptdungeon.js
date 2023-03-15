const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateConformationControls, populateConformationWindow } = require("../sessionTools.js")
const { msToTime } = require("../tools.js")

module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"promptDungeon"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        let playerData = session.session_data.player
        let townData = session.session_data.town

        let now = new Date();
        if(playerData.dungeonTimer == undefined || now.getTime() > playerData.dungeonTimer){
            let newSession = {
                type:"startDungeon",
                session_id: Math.floor(Math.random() * 100000),
                user_ids:[playerData.id],
                session_data:{
                    player:playerData,
                    town:townData
                }
            }
            
            interaction.update({
                content: " ",
                embeds: populateConformationWindow(newSession),
                components: populateConformationControls(newSession)
            })

            callback({
                removeSession:session,
                addSession:newSession
            })
        } else {
            interaction.reply({ content: 'You must wait ' + msToTime(playerData.dungeonTimer - now.getTime()) + ' before attempting another dungeon run', ephemeral: true });
        }
	},
};