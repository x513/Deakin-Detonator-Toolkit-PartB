import { Button, LoadingOverlay, Stack, TextInput, Switch, Modal, Alert, Group } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCallback, useState, useEffect, useRef } from "react";
import { CommandHelper } from "../../utils/CommandHelper";
import ConsoleWrapper from "../ConsoleWrapper/ConsoleWrapper";
import { RenderComponent } from "../UserGuide/UserGuide";
import { SaveOutputToTextFile_v2 } from "../SaveOutputToFile/SaveOutputToTextFile";
import { checkAllCommandsAvailability } from "../../utils/CommandAvailability";
import InstallationModal from "../InstallationModal/InstallationModal";

/**
 * Represents the form values for the DnsenumTool component.
 */

interface FormValuesType {
    domain: string;
    threads: number;
    pages: number;
    scrap: number;
    reverseLookup: boolean;
    timeout: number;
}

/**
 * The DnsenumTool component.
 * @returns The DnsenumTool component.
 */

const DnsenumTool = () => {
    //sets the state of the tool; loading or not, what the output is
    const [loading, setLoading] = useState(false);
    const [output, setOutput] = useState("");
    const [checkedAdvanced, setCheckedAdvanced] = useState(false);
    const [pid, setPid] = useState("");
    const [allowSave, setAllowSave] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);
    const [isCommandAvailable, setIsCommandAvailable] = useState(false);
    const [opened, setOpened] = useState(!isCommandAvailable);
    const [loadingModal, setLoadingModal] = useState(true);
    const [showAlert, setShowAlert] = useState(true);
    const alertTimeout = useRef<NodeJS.Timeout | null>(null);

    /**
     * Component Constants.
     */
    const title = "DNS Enumeration";
    const description =
        "DNSEnum is a command-line tool used for DNS record enumeration. " +
        "It is used to gather information about a specified domain, including subdomains and IP addresses. " +
        "The tool is useful for penetration testers and security researchers, " +
        "as it can help identify potential attack vectors and vulnerabilities in a network. " +
        "DNSEnum supports a variety of DNS record types, including A, MX, NS, and SOA records. ";
    const steps =
        "Using DNS Emueration Tool (Advanced):\n" +
        "Step 1: Enter a Target Domain.\n" +
        "Step 2: Select Advanced Mode.\n" +
        "Step 3: Enter the number of threads to use.\n" +
        "Step 4: Enter the number of pages to search.\n" +
        "Step 5: Enter the number of scrapes to perform.\n" +
        "Step 6: Enter the timeout value.\n" +
        "Step 7: Select Reverse Lookup if required.\n";
    const sourceLink = "https://www.kali.org/tools/dnsenum/";
    const tutorial = "https://docs.google.com/document/d/16uxD3S1daRg1w24uwuhdWgQ3F4MUwxDQdhjKvT3TwVE/edit?usp=sharing";
    const dependencies = ["dnsenum"]; // Dependencies required by the component

    /**
     * intial form values
     */
    const form = useForm<FormValuesType>({
        initialValues: {
            domain: "",
            threads: 10,
            pages: 10,
            scrap: 10,
            reverseLookup: false,
            timeout: 5,
        },
    });

    /**
     * handleProcessData: Callback to handle and append new data from the child process to the output.
     * @param {string} data - The data received from the child process.
     */
    const handleProcessData = useCallback((data: string) => {
        setOutput((prevOutput) => prevOutput + "\n" + data); // Update output
    }, []);

    /**
     * handleProcessTermination: Callback to handle the termination of the child process.
     * @param {object} param - An object containing information about the process termination.
     * @param {number} param.code - The exit code of the terminated process.
     * @param {number} param.signal - The signal code indicating how the process was terminated.
     */

    const handleProcessTermination = useCallback(
        ({ code, signal }: { code: number; signal: number }) => {
            if (code === 0) {
                handleProcessData("\nProcess completed successfully.");
            } else if (signal === 15) {
                handleProcessData("\nProcess was manually terminated.");
            } else {
                handleProcessData(`\nProcess terminated with exit code: ${code} and signal code: ${signal}`);
            }
            // Clear the child process pid reference
            setPid("");
            setLoading(false);
            setAllowSave(true);
            setHasSaved(false);
        },
        [handleProcessData]
    );

    /**
     * onSubmit: Asynchronous handler for the form submission event.
     * It sets up and triggers the dnsenum tool with the given parameters.
     * @param {FormValuesType} values - The form values, containing the domain, threads, pages, scrap, reverse lookup, and timeout.
     */

    //sets the loading state to True, provides arguments for the tool
    const onSubmit = async (values: FormValuesType) => {
        // Disallow saving until the tool's execution is complete
        setAllowSave(false);
        setLoading(true);

        const args = [
            "--nocolor",
            `${values.domain}`,
            "-threads",
            `${values.threads}`,
            "-pages",
            `${values.pages}`,
            "-scrap",
            `${values.scrap}`,
        ];
        if (!values.reverseLookup) {
            args.push("-noreverse");
        }
        args.push("-timeout", `${values.timeout}`);
        try {
            const result = await CommandHelper.runCommandGetPidAndOutput(
                "dnsenum",
                args,
                handleProcessData,
                handleProcessTermination
            );
            setPid(result.pid);
            setOutput(result.output);
        } catch (e: any) {
            setOutput(e.message);
            setLoading(false);
            setAllowSave(true);
        }
    };

    /**
     * handleCancel: Sends a SIGTERM signal to terminate the process.
     */
    const handleCancel = () => {
        if (pid !== null) {
            CommandHelper.runCommand("kill", ["-15", pid])
                .then(() => handleProcessData("\nProcess Terminated Successfully"))
                .catch((e) => handleProcessData("\nFailed to terminate process: ${e.message}"));
        }
    };

    /**
     * clearOutput: Clears the output state.
     */
    const clearOutput = useCallback(() => {
        setOutput("");
        setHasSaved(false);
        setAllowSave(false);
    }, [setOutput]);

    /**
     * handleSaveComplete: Actions taken after saving the output.
     */
    const handleSaveComplete = () => {
        setHasSaved(true);
        setAllowSave(false);
    };

    // useEffect to check for command availability and open modal if required
    useEffect(() => {
        checkAllCommandsAvailability(dependencies)
            .then((isAvailable) => {
                setIsCommandAvailable(isAvailable);
                setOpened(isAvailable);
                setLoadingModal(false);
            })
            .catch((error) => {
                console.error("An error occured: ", error);
                setLoadingModal(false);
            });
        // Set timeout to remove alert after 5 seconds on load.
        alertTimeout.current = setTimeout(() => {
            setShowAlert(false);
        }, 5000);

        return () => {
            if (alertTimeout.current) {
                clearTimeout(alertTimeout.current);
            }
        };
    }, []);

    const handleShowAlert = () => {
        setShowAlert(true);
        if (alertTimeout.current) {
            clearTimeout(alertTimeout.current);
        }
        alertTimeout.current = setTimeout(() => {
            setShowAlert(false);
        }, 5000);
    };

    // useEffect to clear output on component mount
    useEffect(() => {
        clearOutput();
        // Cleanup function to run when the component unmounts
        return () => {
            clearOutput();
        };
    }, [clearOutput]);

    return (
        <RenderComponent
            title={title}
            description={description}
            steps={steps}
            tutorial={tutorial}
            sourceLink={sourceLink}
        >
            {/* Render the installation modal if commands are not available */}
            {!loadingModal && (
                <InstallationModal
                    isOpen={opened}
                    setOpened={setOpened}
                    feature_description={description}
                    dependencies={dependencies}
                ></InstallationModal>
            )}
            <form onSubmit={form.onSubmit(onSubmit)}>
                <LoadingOverlay visible={loading} />
                {loading && (
                    <div>
                        <Button variant="outline" color="red" style={{ zIndex: 1001 }} onClick={handleCancel}>
                            Cancel
                        </Button>
                    </div>
                )}
                <Stack>
                    <Group position="right">
                        {!showAlert && (
                            <Button onClick={handleShowAlert} size="xs" variant="outline" color="gray">
                                Show Disclaimer
                            </Button>
                        )}
                    </Group>
                    {showAlert && (
                        <Alert title="Warning: Potential Risks" color="red">
                            This tool is used to perform DNS enumeration, use with caution and only on targets you own
                            or have explicit permission to test.
                        </Alert>
                    )}

                    <TextInput label={"Domain"} required {...form.getInputProps("domain")} />
                    <Switch
                        size="md"
                        label="Advanced Mode"
                        checked={checkedAdvanced}
                        onChange={(e) => setCheckedAdvanced(e.currentTarget.checked)}
                    />
                    {checkedAdvanced && (
                        <>
                            <TextInput label={"Threads"} {...form.getInputProps("threads")} />
                            <TextInput label={"Pages"} type="number" min={1} {...form.getInputProps("pages")} />
                            <TextInput label={"Scrap"} {...form.getInputProps("scrap")} />
                            <TextInput label={"Timeout"} {...form.getInputProps("timeout")} />
                            <Switch
                                size="md"
                                label="Reverse Lookup"
                                {...form.getInputProps("reverseLookup" as keyof FormValuesType)}
                            />
                        </>
                    )}
                    <Button type={"submit"}>Start Enumeration</Button>
                    {SaveOutputToTextFile_v2(output, allowSave, hasSaved, handleSaveComplete)}
                    <ConsoleWrapper output={output} clearOutputCallback={clearOutput} />
                </Stack>
            </form>
        </RenderComponent>
    );
};

export default DnsenumTool;
