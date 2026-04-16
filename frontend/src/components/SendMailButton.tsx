import {Button, SxProps} from "@mui/material";
import SendIcon from '@mui/icons-material/Send';

type SendMailButtonProps = {
    isEnabled: boolean;
    inProNumbers?: Array<string>
    sx?: SxProps
}

export default function SendMailButton(props: Readonly<SendMailButtonProps>) {
    const generateMailTo = () => {
        const subject = encodeURIComponent("Validated Location data for Project " + props.inProNumbers.join(", "));
        const bodyText = `Dear sir or madam,
This email contains validated location data for the project(s):
${props.inProNumbers.join(", \n")}
It was validated by the "Location Validator" on https://mapme-initiative.github.io/project_location_model/validation.html. You can use the Location Validator Tool (https://mapme-initiative.github.io/project_location_model/validation.html) yourself to check the data validity and see all project locations printed on a map.
Yours sincerely, `;
        const body = encodeURIComponent(bodyText.replace(/\r?\n/g, "\r\n"));
        const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
    }
    return (
        <Button variant="contained"
            disabled={!props.isEnabled}
            endIcon={<SendIcon />} sx={props.sx}
            onClick={generateMailTo} >
            Send Email
        </Button>
    )
}
