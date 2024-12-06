import React, { useState, useEffect, JSX } from "react";
import { Feature, Service } from "../service.ts";
import MissingFeatureBanner from "./MissingFeatureBanner.tsx";

interface IProps {
    service: Service | null;
    onError: (e: Error) => void;
}

const DefaultText = "decrease minutes";

export default function TimeForm({ service, onError }: IProps): Promise<JSX.Element> {
    const [time, setTime] = useState<number>(0);
    const [content, setContent] = useState<string>(DefaultText);
    const [available, setAvailable] = useState<boolean>(false);

    useEffect(() => {
        service?.isFeatureReady(Feature.AddTime)
            .then(setAvailable);
    }, [service]);

    const onSubmit: React.FormEventHandler = async (e: React.FormEvent) => {
        e.preventDefault();
        if (service === null) {
            onError(new Error("Invalid service"));
            return;
        }
        console.info("Decreasing", time, "minutes");
        setContent("...");
        try {
            // Adjusted to call a "decreaseTime" method
            await service.decreaseTime(new Date(time * 60 * 1000)); // Convert minutes to milliseconds
            setTime(0);
        } catch (e) {
            onError(e as Error);
        } finally {
            setContent(DefaultText);
        }
    };

    return (
        <div className="time-form">
            {
                available ? (
                    <form onSubmit={onSubmit}>
                        <input
                            type="number"
                            min="0"
                            placeholder="time to decrease (minutes)"
                            onChange={(e) => setTime(Number(e.target.value) || 0)}
                            value={time}
                            disabled={!available}
                        />
                        <button type="submit" disabled={time <= 0}>{content}</button>
                    </form>
                ) : (
                    <MissingFeatureBanner message="decrease time" />
                )
            }
        </div>
    );
}
