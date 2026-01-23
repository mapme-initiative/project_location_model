/* eslint-disable  @typescript-eslint/no-explicit-any */
import './scss/FileValidator.scss'

import React, { useState } from "react";
import Papa from "papaparse";
import MapComponent from "./MapComponent";

import { transformCsvToLocation, } from "../services/util/FileConversionMethods";
import { saveAs } from 'file-saver';
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Box,
	Typography,
	Alert
} from '@mui/material';

import SendMailButton from "./SendMailButton.tsx";
import {
	excelToGeoJson,
	OGMFileTypes,
	SupportedLangs,
	formatError,
	toValidatedFeature,
	notNull,
	notUndefined,
	formatAjvErrorsWithRow,
	removeWhiteSpaceInFeatureProperty
} from "../services/util/Utils.ts";
import { getProjectValidator } from "../services/util/Validator.ts";
import FileUpload from "./FileUpload.tsx";

export default function FileValidator(): React.ReactElement {
	const [lang, setLang] = useState<SupportedLangs>('en');
	const [validationResult, setValidationResult] = useState<string | null>(null);
	const [geoJsonDataWrap, setGeoJsonDataWrap] = useState<any>(null);
	const [enableEMailButton, setEnableEMailButton] = useState<boolean>(false);
	const [openNoSheetDialog, setOpenNoSheetDialog] = React.useState(false);
	const [inProNumbers, setInProNumbers] = useState<Set<string> | null>(null);


	function handleCSVFiles(data: string | ArrayBuffer | null | undefined) {
		try {
			const parsedData = Papa.parse(data as string, { header: true }).data;
			const transformedData = transformCsvToLocation(parsedData);
			setGeoJsonDataWrap({ type: "FeatureCollection", features: transformedData })
			validateParsedData(transformedData);
		} catch (e) {
			setValidationResult(`CSV-Files: ${e.message}`)
		}
	}

	const handleJsonFiles = (file: File) => {
		console.debug("handleJsonFiles")
		Promise.all([file.text(), getProjectValidator(lang)])
			.then(([text, validateProjectFunction]) => {
				//init validateProjects
				const validateProject = validateProjectFunction

				// Parse the uploaded GeoJSON
				const geoJsonData = JSON.parse(text);

				// Check if the input is a Feature or a FeatureCollection
				switch (geoJsonData.type) {
					case "Feature": {
						const isValid = validateProject ? validateProject(geoJsonData) : false;
						if (isValid) {
							setValidationResult("GeoJSON Feature Data is valid!");
							setGeoJsonDataWrap({ type: "FeatureCollection", features: [geoJsonData] }); // Wrap in FeatureCollection
						} else {
							// Format validation errors
							const formattedErrors = (validateProject.errors || [])
								.map(formatError)
								.join("\n");
							setValidationResult(`GeoJSON Feature Validation Errors:\n${formattedErrors}`);
						}
						break;
					}
					case "FeatureCollection": {
						const transformedFeatures = geoJsonData.features
							.map((feature: any) => toValidatedFeature(feature, validateProject))
							.filter(notNull); // Remove invalid features
						if (transformedFeatures.length === geoJsonData.features.length) {
							setValidationResult("GeoJSON FeatureCollection Data is valid!");
						} else {
							setValidationResult(
								"Error: Some features in the GeoJSON FeatureCollection failed validation."
							);
						}

						// Set the valid features in the state
						setGeoJsonDataWrap({
							type: "FeatureCollection",
							features: transformedFeatures,
						});
						break;
					}
					default: {
						setValidationResult("Error: GeoJSON file must be a Feature or FeatureCollection.");
						return;
					}
				}
			})
			.catch(e => {
				console.error(e)
				setValidationResult(`Errors at json-validating: ${e.message} `)
			})
	}
	const resetMap = () => {
		console.debug("resetMap()")
		// Clear the GeoJSON data and reset the validation result
		setGeoJsonDataWrap(null);
		setValidationResult(null);
		setOpenNoSheetDialog(false)
		setEnableEMailButton(false)

	};
	function handleExcelFiles(
		data: string | ArrayBuffer | null | undefined
	) {
		try {
			const transformedData = excelToGeoJson(data, lang)
			console.log(transformedData);
			validateParsedData(transformedData);
			setGeoJsonDataWrap({ type: "FeatureCollection", features: transformedData });
		} catch (error) {
			console.error(error)
			if (error instanceof Error) {
				setValidationResult(`Error processing Excel file: ${error.message}`);
			} else {
				setValidationResult('An unknown error occurred while processing the Excel file');
			}
		}
	}

	// FileUpload Event und Filetyp-Verarbeitung
	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		resetMap()
		console.debug("handleFileUpload()")
		const file = event.target.files?.[0];
		if (!file) return;

		const fileType = file.type == "" && file.name.includes(".geojson") ? "application/geo+json" : file.type;
		const reader = new FileReader();

		switch (fileType) {
			case OGMFileTypes.GEOJSON:
			case OGMFileTypes.JSON_APP:
			case OGMFileTypes.JSON_TEXT:
				//Fall 1. direktes Einspielen als GeoJson TODO: Bisher wird nur eine Feature als Geojson-Upload verarbeitet mehrere Features noch nicht
				handleJsonFiles(file);
				break;
			case OGMFileTypes.CSV:
				reader.onload = (e) => {
					const data = e.target?.result;
					handleCSVFiles(data);
				}
				reader.readAsBinaryString(file);
				break;
			case OGMFileTypes.XLS:
			case OGMFileTypes.OPENOFFICE:
			case OGMFileTypes.XLSX:
				reader.onload = (e) => {
					const data = e.target?.result;
					handleExcelFiles(data);
				}
				reader.readAsBinaryString(file);
				break
			default:
				setValidationResult("Unsupported file type. Please upload a JSON, CSV, or Excel file.");
				return;
		}
	};

	const validateParsedData = (data: any[]) => {
		getProjectValidator(lang)
			.then((validateProjectFunction) => {
				const validateProject = validateProjectFunction
				// Validate each row in the CSV/Excel data, flatMap sonst ist allErrors Object nicht 0 von der Länge bei keinen fehlern
				const allErrors = data
					.flatMap((row, index) => {
						validateProject(row);
						if (validateProject.errors != null)
							return formatAjvErrorsWithRow(validateProject.errors, index + 1);
						else
							return
						//TODO: Format the errors for this row
					})
					.filter(notUndefined)
				console.log("validateParsedData().allErrors", allErrors)
				if (allErrors.length == 0) { // Wenn keine Fehler gefunden wurden & alle datenreihen eine inproNumber haben, dann aktiviere den Mail-Button
					setValidationResult("Excel/CSV data is valid!");
					console.log("validateParsedData().data:", data)
					const localInproNumbers = data.map(removeWhiteSpaceInFeatureProperty)
					console.log("validateParsedData().localInproNumbers:", localInproNumbers)
					if (localInproNumbers.filter((n: any) => n === undefined && n === null).length > 0) { // this here should never happened, it just represent the worst case of data cause we've finished our validation-process!
						setValidationResult("Something terrible happend, we've inpro-nos which are null or undefined and they passed our validation. Please check your data again and send this crazy dataset to the it-support (us), please.")
						return;
					}
					setEnableEMailButton(true)
					setInProNumbers(new Set(localInproNumbers))
				} else {
					setValidationResult(`Validation Errors:\n${allErrors.join("\n")}`);
					setEnableEMailButton(false)
				}

			}).catch(e => {
				console.error(e)
				setValidationResult(`Error: looks like you internet connection problems: ${e.message}`)
			})
	};

	const downloadProcessed = () => {
		const blob = new Blob([JSON.stringify(geoJsonDataWrap)], { type: 'application/geo+json' });
		saveAs(blob, 'validated_data.geojson');
	};
	return <div className='file_validator'>

		<Dialog
			open={openNoSheetDialog}
			onClose={resetMap}
			aria-labelledby="alert-dialog-title"
			aria-describedby="alert-dialog-description"
		>
			<DialogTitle id="alert-dialog-title">
				{"'fill-me' Sheet not found!"}
			</DialogTitle>
			<DialogContent>
				<DialogContentText id="alert-dialog-description">
					{"You dont use the original excel-template. The excel-template has a second sheet called fill-me please adjust your data."}
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={resetMap} autoFocus>
					I will reset map and retry manually
				</Button>
			</DialogActions>
		</Dialog>

		{/* ____________________ Header / Description ____________________ */}

		<Box className="editor-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
			<Typography variant="h5" component="h1">
				Location Validator
			</Typography>
			<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
				<FormControl variant="outlined" size="small">
					<InputLabel id="lang-select-label" sx={{ color: 'white' }}>Language</InputLabel>
					<Select
						labelId="lang-select-label"
						value={lang}
						onChange={e => setLang(e.target.value as 'en' | 'fr')}
						label="Language"
						sx={{ 
							color: 'white',
							'& .MuiOutlinedInput-notchedOutline': {
								borderColor: 'rgba(255, 255, 255, 0.7)',
							},
							'&:hover .MuiOutlinedInput-notchedOutline': {
								borderColor: 'white',
							},
							'& .MuiSvgIcon-root': {
								color: 'white',
							}
						}}
					>
						<MenuItem value="en">English</MenuItem>
						<MenuItem value="fr">Francais</MenuItem>
					</Select>
				</FormControl>
				<FileUpload
					sx={{ ml: 1.5 }}
					onChange={handleFileUpload}
					title={"File upload"}
				/>
				<SendMailButton sx={{ ml: 1.5 }} isEnabled={enableEMailButton} {...(inProNumbers ? { inProNumbers: [...inProNumbers] } : {})} />
				<Button
					sx={{ ml: 1.5 }}
					variant={"contained"}
					disabled={!enableEMailButton}
					onClick={downloadProcessed}
				>Download GeoJSON</Button>
				<Button target="_blank" href={"https://github.com/mapme-initiative/project_location_model/issues"} sx={{ ml: 1.5 }} variant={"contained"} color={"error"}>report Issue</Button>
			</Box>
		</Box>

		<Alert severity="info" sx={{ mb: 2 }}>
			<Typography variant="body2">
				The Location Validator is an open-source tool designed to validate project location data against the specifications of <a target={"_blank"} href={"google.de"}>KfWs Open Project Location Model</a>. The validator accepts both Excel and GeoJSON files as input data. It identifies errors that need to be addressed, such as missing values in mandatory fields or incorrect formats for specific entries (e.g., dates not provided in the correct format). <br /><br />Errors should be corrected in the original file using Excel or GIS software, after which the files can be re-evaluated using this tool. Additionally, you can utilize the map feature within the tool to assess the geographic accuracy of the submitted project locations.
				Once all locations are valid, the "SEND EMAIL" button will appear blue. You can than send an email with the validated data to your project counterpart.
			</Typography>
		</Alert>

		<Alert severity="warning" sx={{ mb: 2 }}>
			<Typography variant="body2" component="div">
				<strong>Important:</strong>
				<ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
					<li>Make sure to attach the latest validated (and valid) version to the email.</li>
					<li>In case of any problems or feature request create an issue at our <a href={"https://github.com/mapme-initiative/project_location_model/issues"}>Github-Issue-Tracker</a>.</li>
				</ul>
			</Typography>
		</Alert>



		{/* ____________________ Validation Result ____________________ */}

		{validationResult && (
			<Alert 
				severity={validationResult.toLowerCase().includes("data is valid!") ? "success" : "error"}
				sx={{ mb: 2, maxHeight: '360px', overflowY: 'auto' }}
			>
				<Typography variant="h6" component="div" sx={{ mb: 1, fontWeight: 600 }}>
					Validation Result
				</Typography>
				<Typography variant="body2" component="pre" sx={{ 
					whiteSpace: 'pre-wrap', 
					wordWrap: 'break-word',
					fontFamily: 'monospace',
					margin: 0
				}}>
					{validationResult}
				</Typography>
			</Alert>
		)}


		{/* ____________________ Map ____________________ */}

		<div className='file_validator_map'>
			<MapComponent geoJsonData={geoJsonDataWrap} />
		</div>



		{/* ____________________ Buttons ____________________ */}

		<Box sx={{ mt: 2, mb: 2 }}>
			<Button
				variant="contained"
				onClick={resetMap}
			>
				Reset Map
			</Button>
		</Box>



		{/* ____________________ Example ____________________ */}

		<Typography variant="h6" component="h4" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
			Example Files:
		</Typography>
		<ul className="example-files">
			<li><p><a href={"./Project_Location_Data_Template_EN_V03.xlsx"}>working example</a></p></li>
			<li><p><a href={"./Project_Location_Data_Template_FR_V03.xlsx"}>french example</a></p></li>
			<li><p><a href={"./sheet_not_found.xlsx"}>no fill-me sheet</a></p></li>
			<li><p><a href={"./invalid_data.xlsx"}>invalid_data</a></p></li>
			<li><p><a href={"./missing_lat_lon.xlsx"}>missing_lat_lon</a></p></li>
		</ul>

	</div>
}
