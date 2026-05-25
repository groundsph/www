import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components"

interface ClaimRejectedEmailProps {
    cafeName: string
    ownerName?: string
    reason?: string
}

const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: "#74512d",
                secondary: "#af8f6f",
                tertiary: "#f8f4e1",
                background: "#f8f4e1",
                text: "#543310",
            },
        },
    },
}

export default function ClaimRejectedEmail({
    cafeName,
    ownerName,
    reason,
}: ClaimRejectedEmailProps) {
    return (
        <Html>
            <Preview>
                {`Update on your ownership claim for "${cafeName}"`}
            </Preview>
            <Tailwind config={tailwindConfig}>
                <Head />
                <Body className='bg-tertiary font-sans'>
                    <Container className='mx-auto py-12 px-4 max-w-xl'>
                        {/* Header */}
                        <Section className='text-center mb-8'>
                            <Heading className='text-4xl font-bold text-primary font-serif m-0'>
                                GroundsPH
                            </Heading>
                        </Section>

                        {/* Main Card */}
                        <Section className='bg-white rounded-2xl p-8 shadow-lg'>
                            <Heading className='text-2xl font-semibold text-text mt-0 mb-4'>
                                Claim Update
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {ownerName ? `Hey ${ownerName},` : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Thank you for submitting an ownership claim for{" "}
                                <strong>{cafeName}</strong>. After reviewing
                                your submission, we were unable to verify
                                ownership at this time.
                            </Text>

                            {reason && (
                                <Section className='bg-tertiary rounded-lg p-4 my-4'>
                                    <Text className='text-text text-sm m-0'>
                                        <strong>Note from our team:</strong>
                                    </Text>
                                    <Text className='text-text text-sm m-0 mt-2'>
                                        {reason}
                                    </Text>
                                </Section>
                            )}

                            <Text className='text-text text-base leading-relaxed'>
                                If you believe this was an error or have
                                additional documentation to support your claim,
                                you&apos;re welcome to submit a new claim with
                                more detailed proof of ownership.
                            </Text>

                            <Text className='text-secondary text-sm mt-6'>
                                Common accepted proof includes:
                            </Text>
                            <ul className='text-secondary text-sm'>
                                <li>Business registration documents</li>
                                <li>DTI or SEC registration</li>
                                <li>Lease agreements or property documents</li>
                                <li>
                                    Official social media account verification
                                </li>
                            </ul>
                        </Section>

                        {/* Footer */}
                        <Section className='text-center mt-8'>
                            <Hr className='border-secondary my-6' />
                            <Text className='text-secondary text-sm m-0'>
                                © {new Date().getFullYear()} GroundsPH. All rights
                                reserved.
                            </Text>
                            <Text className='text-secondary text-xs mt-2'>
                                You received this email because you submitted an
                                ownership claim on GroundsPH.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
