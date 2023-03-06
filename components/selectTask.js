const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateTaskWindow, populateTasksControls } = require("../sessionTools.js")


module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"selectTask"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.type == "townVisit"){
            
            
            let task = session.session_data.town.taskList[interaction.values[0]];
            session.session_data.temp = {
                currentTask:task
            }

            
            interaction.update({
                content: " ",
                embeds: populateTaskWindow(session),
                components: populateTasksControls(session)
            })

            callback({})
        }
	},
};